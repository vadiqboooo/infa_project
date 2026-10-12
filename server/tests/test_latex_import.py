import unittest

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.database import Base
from app.dependencies import get_current_user, get_db, verify_parser_api_key
from app.models.exam import Exam, exam_tasks
from app.models.exam_attempt import ExamAttempt
from app.models.progress import UserProgress, ProgressStatus
from app.models.task import Task, AnswerType
from app.models.topic import Topic
from app.models.user import User
from app.routers import admin, content, solving, exams
from app.services.latex_import import parse_latex_worksheet

WORKSHEET = r"""Разминка
Номера из исходника.

№ 2.1
Упростите выражение.
\[
\sin\left(\frac{3\pi}{2}-\alpha\right)
\]
Ответ: \( -\cos\alpha \).

№ 4.2
Вычислите \( -\sqrt{8}/2 \).
Ответ: \( -\sqrt{2} \).

№ 5
Вычислите \( 1-1 \).
Ответ: \( 0 \).
"""


@compiles(JSONB, "sqlite")
def sqlite_jsonb(element, compiler, **kw):
    return "JSON"


class LatexParserTests(unittest.TestCase):
    def test_format_bom_crlf_numbering_and_html_escaping(self):
        parsed = parse_latex_worksheet("\ufeff" + WORKSHEET.replace("\n", "\r\n"))
        self.assertEqual(parsed["topic_title"], "Разминка")
        self.assertEqual([t["title"] for t in parsed["tasks"]], ["№ 2.1", "№ 4.2", "№ 5"])
        self.assertEqual(parsed["tasks"][-1]["correct_answer"], {"val": "0"})
        self.assertNotIn("Ответ", parsed["tasks"][0]["content_html"])
        self.assertIn(r"\frac{3\pi}{2}", parsed["tasks"][0]["content_html"])
        task = parse_latex_worksheet('Задание 1\n<script>alert(1)</script>\nОтвет: 2')["tasks"][0]
        self.assertNotIn("<script>", task["content_html"])
        self.assertIn("&lt;script&gt;", task["content_html"])

    def test_rejects_bad_worksheets_without_partial_import(self):
        for text in ["", "Непонятный формат", "№ 1\nУсловие", "№ 1\nОтвет: 2",
                     "№ 1\nУсловие\nОтвет:", WORKSHEET.replace("№ 4.2", "№ 2.1"),
                     WORKSHEET.replace(r"-\sqrt{2}", r"\unknown{2}"),
                     "№ 1\nУсловие\nОтвет: 1\nОтвет: 2"]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_latex_worksheet(text)


class LatexImportTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.user = User(id=1, role="admin")
        async with self.sessions() as db:
            db.add(self.user)
            await db.commit()

        async def test_db():
            async with self.sessions() as db:
                yield db

        self.app = FastAPI()
        self.app.dependency_overrides[get_db] = test_db
        self.app.dependency_overrides[get_current_user] = lambda: self.user
        self.app.dependency_overrides[verify_parser_api_key] = lambda: None
        self.app.include_router(admin.router, prefix="/admin")
        for router in (content.router, solving.router, exams.router):
            self.app.include_router(router)
        self.client = AsyncClient(transport=ASGITransport(app=self.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.engine.dispose()

    async def test_preview_confirm_student_check_and_no_answer_leak(self):
        preview = await self.client.post("/admin/import-latex/parse", files={"file": ("warmup.txt", WORKSHEET.encode())})
        self.assertEqual(preview.status_code, 200, preview.text)
        data = preview.json()
        async with self.sessions() as db:
            self.assertEqual(await db.scalar(select(func.count(Topic.id))), 0)
        confirmed = await self.client.post("/admin/import-pdf/confirm", json={**data, "category": "math", "subject": "math"})
        self.assertEqual(confirmed.status_code, 201, confirmed.text)
        self.assertEqual(confirmed.json()["created_count"], 3)
        async with self.sessions() as db:
            tasks = list((await db.scalars(select(Task).order_by(Task.order_index))).all())
            self.assertEqual([t.title for t in tasks], ["№ 2.1", "№ 4.2", "№ 5"])
            self.assertTrue(all(t.subject == "math" and t.answer_type == AnswerType.math_expression for t in tasks))
            self.assertEqual(await db.scalar(select(func.count(Exam.id))), 1)
            self.assertEqual(await db.scalar(select(func.count()).select_from(exam_tasks)), 3)
        public = await self.client.get(f"/tasks/{tasks[1].id}")
        self.assertEqual(public.status_code, 200, public.text)
        self.assertNotIn("correct_answer", public.json())
        self.assertNotIn("Ответ:", public.json()["content_html"])
        empty = await self.client.post(f"/tasks/{tasks[2].id}/check", json={"answers": [None]})
        self.assertEqual(empty.status_code, 200, empty.text)
        self.assertFalse(empty.json()["correct"])
        for task, answer in zip(tasks, ["-cos(alpha)", "-sqrt(8)/2", "0"]):
            result = await self.client.post(f"/tasks/{task.id}/check", json={"val": answer})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertTrue(result.json()["correct"])
        async with self.sessions() as db:
            progress = list((await db.scalars(select(UserProgress))).all())
            self.assertTrue(all(p.status == ProgressStatus.solved for p in progress))
            exam_id = await db.scalar(select(Exam.id))
        started = await self.client.post(f"/exams/{exam_id}/start")
        self.assertEqual(started.status_code, 200, started.text)
        draft = await self.client.put(f"/exams/attempt/{started.json()['attempt_id']}/save-answer", json={
            "task_id": tasks[1].id, "answer": {"val": "-sqrt(8)/2"},
        })
        self.assertEqual(draft.status_code, 200, draft.text)
        self.assertTrue(draft.json()["is_correct"])
        submitted = await self.client.post(f"/exams/{exam_id}/submit", json={"answers": [
            {"task_id": task.id, "answer": {"val": value}}
            for task, value in zip(tasks, ["-cos(alpha)", "-sqrt(8)/2", "0"])
        ]})
        self.assertEqual(submitted.status_code, 200, submitted.text)
        self.assertEqual(submitted.json()["correct_count"], 3)

        exam_mode_started = await self.client.post(f"/exams/{exam_id}/start?mode=exam")
        self.assertEqual(exam_mode_started.status_code, 200, exam_mode_started.text)
        hidden_draft = await self.client.put(
            f"/exams/attempt/{exam_mode_started.json()['attempt_id']}/save-answer",
            json={"task_id": tasks[1].id, "answer": {"val": "-sqrt(8)/2"}},
        )
        self.assertEqual(hidden_draft.status_code, 200, hidden_draft.text)
        self.assertNotIn("is_correct", hidden_draft.json())
        self.assertNotIn("points", hidden_draft.json())
        active_exam = await self.client.get(f"/exams/by-topic/{tasks[0].topic_id}")
        self.assertEqual(active_exam.status_code, 200, active_exam.text)
        self.assertEqual(active_exam.json()["active_attempt"]["mode"], "exam")
        self.assertEqual(
            active_exam.json()["active_attempt"]["draft_answers"][str(tasks[1].id)]["val"],
            "-sqrt(8)/2",
        )
        self.assertEqual(active_exam.json()["active_attempt"]["scored_answers"], {})

        exam_mode_result = await self.client.post(f"/exams/{exam_id}/submit", json={"answers": [
            {"task_id": task.id, "answer": {"val": value}}
            for task, value in zip(tasks, ["-cos(alpha)", "-sqrt(8)/2", "0"])
        ]})
        self.assertEqual(exam_mode_result.status_code, 200, exam_mode_result.text)
        self.assertEqual(exam_mode_result.json()["correct_count"], 3)

        # Legacy clients could leave an empty attempt without a selected mode.
        # It must return to the mode picker instead of silently becoming practice.
        async with self.sessions() as db:
            legacy_attempt = ExamAttempt(user_id=self.user.id, exam_id=exam_id, results_json={})
            db.add(legacy_attempt)
            await db.commit()
            await db.refresh(legacy_attempt)
            legacy_attempt_id = legacy_attempt.id
        legacy_info = await self.client.get(f"/exams/by-topic/{tasks[0].topic_id}")
        self.assertIsNone(legacy_info.json()["active_attempt"]["mode"])
        navigation = await self.client.get("/navigation")
        legacy_topic = next(item for item in navigation.json() if item["id"] == tasks[0].topic_id)
        self.assertTrue(legacy_topic["has_active_attempt"])
        self.assertIsNone(legacy_topic["active_exam_mode"])
        resumed = await self.client.post(f"/exams/{exam_id}/start?mode=exam")
        self.assertEqual(resumed.json()["attempt_id"], legacy_attempt_id)
        resumed_info = await self.client.get(f"/exams/by-topic/{tasks[0].topic_id}")
        self.assertEqual(resumed_info.json()["active_attempt"]["mode"], "exam")

        invalid_edit = await self.client.put(f"/admin/tasks/{tasks[1].id}", json={"correct_answer": {"val": "1/0"}})
        self.assertEqual(invalid_edit.status_code, 400, invalid_edit.text)
        valid_edit = await self.client.put(f"/admin/tasks/{tasks[1].id}", json={"correct_answer": {"val": "-sqrt(8)/2"}})
        self.assertEqual(valid_edit.status_code, 200, valid_edit.text)
        self.assertEqual(valid_edit.json()["answer_type"], "math_expression")

    async def test_invalid_confirm_does_not_create_topic(self):
        data = parse_latex_worksheet(WORKSHEET)
        data["tasks"][1]["correct_answer"] = {"val": "1/0"}
        response = await self.client.post("/admin/import-pdf/confirm", json=data)
        self.assertEqual(response.status_code, 400, response.text)
        async with self.sessions() as db:
            self.assertEqual(await db.scalar(select(func.count(Topic.id))), 0)
            self.assertEqual(await db.scalar(select(func.count(Task.id))), 0)

    async def test_upload_validation_and_auth(self):
        for filename, data, expected in [("a.pdf", b"test", 400), ("a.txt", b"\xff", 400), ("a.tex", b"x" * (1024 * 1024 + 1), 413)]:
            response = await self.client.post("/admin/import-latex/parse", files={"file": (filename, data)})
            self.assertEqual(response.status_code, expected, response.text)
        del self.app.dependency_overrides[verify_parser_api_key]
        response = await self.client.post("/admin/import-latex/parse", files={"file": ("a.txt", WORKSHEET.encode())})
        self.assertEqual(response.status_code, 403, response.text)


if __name__ == "__main__":
    unittest.main()
