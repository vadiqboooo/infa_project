"""Removing a task from a topic must preserve its content and student work."""
import unittest

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.database import Base
from app.dependencies import get_current_user, get_db, verify_parser_api_key
from app.models.exam import Exam, exam_tasks
from app.models.exam_attempt import ExamAttempt
from app.models.progress import ProgressStatus, UserProgress
from app.models.task import Task
from app.models.task_solution import UserTaskSolution
from app.models.topic import Topic
from app.models.user import User
from app.routers import admin, content, solving


@compiles(JSONB, "sqlite")
def sqlite_jsonb(element, compiler, **kw):
    return "JSON"


class TopicTaskTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        @event.listens_for(self.engine.sync_engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.user = User(id=1, role="admin")
        async with self.sessions() as db:
            db.add_all([self.user, Topic(id=1, title="Source", subject="math", exam_type="oge"), Topic(id=2, title="Other")])
            await db.flush()
            db.add_all([
                Task(id=10, topic_id=1, content_html="<p>Question</p>", correct_answer={"val": 8}, media_resources={"files": [{"url": "/uploads/test.txt", "name": "test.txt"}]}),
                Task(id=20, topic_id=2, content_html="Other question"),
                Exam(id=1, topic_id=1), Exam(id=2, topic_id=2),
            ])
            await db.flush()
            db.add_all([
                UserProgress(id=1, user_id=1, task_id=10, status=ProgressStatus.solved, attempts_count=3),
                UserTaskSolution(id=1, user_id=1, task_id=10, code="print(8)", recognized_text="My solution"),
                ExamAttempt(id=1, user_id=1, exam_id=1, results_json={"draft_answers": {"10": {"val": 8}}}),
            ])
            await db.execute(exam_tasks.insert(), [{"exam_id": 1, "task_id": 10}, {"exam_id": 2, "task_id": 20}])
            await db.commit()

        async def test_db():
            async with self.sessions() as db:
                yield db

        self.app = FastAPI()
        self.app.dependency_overrides[get_db] = test_db
        self.app.dependency_overrides[get_current_user] = lambda: self.user
        self.app.dependency_overrides[verify_parser_api_key] = lambda: None
        self.app.include_router(admin.router)
        self.app.include_router(content.router)
        self.app.include_router(solving.router)
        self.client = AsyncClient(transport=ASGITransport(app=self.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.engine.dispose()

    async def test_detach_preserves_task_student_work_and_bank_access(self):
        response = await self.client.delete("/topics/1/tasks/10")
        self.assertEqual(response.status_code, 204, response.text)
        self.assertEqual((await self.client.get("/tasks?topic_id=1")).json(), [])
        navigation = (await self.client.get("/navigation")).json()
        self.assertEqual(next(t for t in navigation if t["id"] == 1)["tasks"], [])

        bank = await self.client.get("/task-bank?subject=math&exam_type=oge")
        self.assertEqual(bank.status_code, 200, bank.text)
        task = next(t for t in bank.json() if t["id"] == 10)
        self.assertIsNone(task["topic_id"])
        self.assertEqual(task["topic_title"], "Без топика")
        self.assertEqual(task["content_html"], "<p>Question</p>")
        self.assertEqual(task["correct_answer"], {"val": 8})
        async with self.sessions() as db:
            stored = await db.get(Task, 10)
            self.assertEqual(stored.media_resources["files"][0]["url"], "/uploads/test.txt")
            progress = await db.get(UserProgress, 1)
            self.assertEqual(progress.status, ProgressStatus.solved)
            self.assertEqual(progress.attempts_count, 3)
            self.assertEqual((await db.get(UserTaskSolution, 1)).code, "print(8)")
            self.assertEqual((await db.get(ExamAttempt, 1)).results_json, {"draft_answers": {"10": {"val": 8}}})
            self.assertEqual((await db.execute(select(exam_tasks))).all(), [(2, 20)])

        edited = await self.client.put("/tasks/10", json={"content_html": "Updated"})
        self.assertEqual(edited.status_code, 200, edited.text)
        self.assertIsNone(edited.json()["topic_id"])
        attached = await self.client.post("/topics/2/tasks/attach", json={"task_id": 10})
        self.assertEqual(attached.status_code, 200, attached.text)
        self.assertEqual(attached.json()["id"], 10)
        self.assertEqual(attached.json()["topic_id"], 2)
        async with self.sessions() as db:
            self.assertEqual((await db.get(UserProgress, 1)).status, ProgressStatus.solved)
            self.assertEqual((await db.get(UserTaskSolution, 1)).recognized_text, "My solution")

    async def test_wrong_topic_and_missing_task_do_not_change_membership(self):
        for path in ("/topics/1/tasks/20", "/topics/99/tasks/10", "/topics/1/tasks/99"):
            response = await self.client.delete(path)
            self.assertEqual(response.status_code, 404, response.text)
        async with self.sessions() as db:
            self.assertEqual((await db.get(Task, 10)).topic_id, 1)
            self.assertEqual((await db.get(Task, 20)).topic_id, 2)

    async def test_topic_exam_type_is_synced_to_tasks_and_public_task(self):
        response = await self.client.put(
            "/topics/1",
            json={"title": "Source", "subject": "math", "exam_type": "oge"},
        )
        self.assertEqual(response.status_code, 200, response.text)

        public_task = await self.client.get("/tasks/10")
        self.assertEqual(public_task.status_code, 200, public_task.text)
        self.assertEqual(public_task.json()["subject"], "math")
        self.assertEqual(public_task.json()["exam_type"], "oge")

        async with self.sessions() as db:
            stored = await db.get(Task, 10)
            self.assertEqual(stored.subject, "math")
            self.assertEqual(stored.exam_type, "oge")

    async def test_detach_requires_admin_credentials(self):
        del self.app.dependency_overrides[verify_parser_api_key]
        response = await self.client.delete("/topics/1/tasks/10")
        self.assertEqual(response.status_code, 403, response.text)
        async with self.sessions() as db:
            self.assertEqual((await db.get(Task, 10)).topic_id, 1)

    async def test_composite_19_21_conditions_and_independent_answers(self):
        async with self.sessions() as db:
            topic = await db.get(Topic, 1)
            topic.subject = "informatics"
            topic.exam_type = "ege"
            task = await db.get(Task, 10)
            task.ege_number = 19
            task.content_html = "Condition 19"
            task.correct_answer = {"val": 8}
            task.sub_tasks = [
                {"number": 20, "content_html": "Condition 20", "answer_type": "single_number", "correct_answer": {"val": 15}},
                {"number": 21, "content_html": "Condition 21", "answer_type": "single_number", "correct_answer": {"val": 24}},
            ]
            await db.commit()

        navigation = (await self.client.get("/navigation")).json()
        topic = next(t for t in navigation if t["id"] == 1)
        self.assertEqual([t["id"] for t in topic["tasks"]], [10])
        self.assertEqual(topic["tasks"][0]["ege_number_max"], 21)
        detail = await self.client.get("/tasks/10")
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["content_html"], "Condition 19")
        self.assertEqual([s["content_html"] for s in detail.json()["sub_tasks"]], ["Condition 20", "Condition 21"])
        self.assertNotIn("correct_answer", detail.json()["sub_tasks"][0])

        # Change one answer at a time; the other two must survive unchanged.
        for answers, expected in [
            ([8, 15, 24], [True, True, True]),
            ([9, 15, 24], [False, True, True]),
            ([8, 16, 24], [True, False, True]),
            ([8, 15, 25], [True, True, False]),
        ]:
            response = await self.client.post("/tasks/10/check", json={"answers": answers})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["sub_results"], expected)
            self.assertEqual(response.json()["correct"], all(expected))
            restored = (await self.client.get("/tasks/10")).json()
            self.assertEqual(restored["last_answer"], {"answers": answers})
            self.assertEqual(restored["last_correct"], all(expected))


if __name__ == "__main__":
    unittest.main()
