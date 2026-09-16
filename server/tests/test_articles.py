"""Run: python -m unittest discover -s tests -v (uses an isolated SQLite database)."""
import unittest

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import event, insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.config import settings
from app.database import Base
from app.dependencies import get_db
from app.models.group import Group, user_groups
from app.models.user import User
from app.models.topic import Topic
from app.routers import articles, group_plan


@compiles(JSONB, "sqlite")
def sqlite_jsonb(element, compiler, **kw):
    return "JSON"


QUESTIONS = [
    {"prompt": "Single?", "type": "single", "options": ["A", "B"], "correct_answers": [1], "explanation": "Because B"},
    {"prompt": "Multiple?", "type": "multiple", "options": ["A", "B", "C"], "correct_answers": [0, 2], "explanation": "A and C"},
    {"prompt": "True?", "type": "boolean", "options": ["Верно", "Неверно"], "correct_answers": [0], "explanation": ""},
]


class ArticleIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        @event.listens_for(self.engine.sync_engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.sessions() as db:
            db.add_all([User(id=1, role="admin"), User(id=2), User(id=3), Group(id=1, name="Test group")])
            await db.commit()
            await db.execute(insert(user_groups).values(user_id=2, group_id=1))
            await db.commit()

        async def test_db():
            async with self.sessions() as db:
                yield db

        app = FastAPI()
        app.dependency_overrides[get_db] = test_db
        for router in (articles.router, articles.admin_router, group_plan.router, group_plan.admin_router):
            app.include_router(router)
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.engine.dispose()

    async def request(self, method, path, body=None, user=1):
        headers = {}
        if user:
            token = jwt.encode({"sub": str(user)}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
            headers["Authorization"] = f"Bearer {token}"
        return await self.client.request(method, path, json=body, headers=headers)

    async def create(self, **overrides):
        response = await self.request("POST", "/admin/articles", {"title": "Test article", "content": "## Hello\nRead me", "published": True, "questions": QUESTIONS, **overrides})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    async def test_publication_permissions_and_answer_secrecy(self):
        article = await self.create(published=False)
        path = f'/articles/{article["id"]}'
        self.assertEqual((await self.request("GET", path, user=2)).status_code, 404)
        self.assertEqual((await self.request("GET", "/admin/articles", user=2)).status_code, 403)
        self.assertEqual((await self.request("POST", "/admin/articles", article, user=2)).status_code, 403)
        self.assertIn((await self.request("GET", path, user=None)).status_code, (401, 422))
        article["published"] = True
        response = await self.request("PUT", f'/admin/articles/{article["id"]}', article)
        self.assertEqual(response.status_code, 200, response.text)
        public = await self.request("GET", path, user=2)
        self.assertEqual(public.status_code, 200)
        self.assertEqual(set(public.json()["questions"][0]), {"prompt", "type", "options"})
        self.assertNotIn("correct_answers", public.text)
        self.assertNotIn("explanation", public.text)

    async def test_quiz_read_gate_exact_grading_best_score_and_user_isolation(self):
        article = await self.create()
        path = f'/articles/{article["id"]}'
        correct = {"revision": 1, "answers": [[1], [2, 0], [0]]}
        self.assertEqual((await self.request("POST", path + "/quiz", correct, user=2)).status_code, 400)
        response = await self.request("POST", path + "/read", {"revision": 1}, user=2)
        self.assertFalse(response.json()["completed"])
        wrong = {"revision": 1, "answers": [[0], [0], [1]]}
        response = await self.request("POST", path + "/quiz", wrong, user=2)
        self.assertEqual(response.json()["score"], 0)
        self.assertEqual(set(response.json()), {"score", "total", "progress"})
        self.assertNotIn("correct_answers", response.text)
        self.assertNotIn("explanation", response.text)
        response = await self.request("POST", path + "/quiz", correct, user=2)
        self.assertEqual(response.json()["score"], 3)
        self.assertEqual(set(response.json()), {"score", "total", "progress"})
        self.assertTrue(response.json()["progress"]["completed"])
        response = await self.request("POST", path + "/quiz", wrong, user=2)
        self.assertEqual(response.json()["progress"]["best_score"], 3)
        self.assertEqual(response.json()["progress"]["attempts"], 3)
        other = (await self.request("GET", path, user=3)).json()["progress"]
        self.assertFalse(other["read"])
        self.assertEqual(other["attempts"], 0)
        for answers in ([[1], [0, 0], [0]], [[1, 0], [0, 2], [0]], [[1], [0, 2], [2]], [[1], [], [0]], [[1]]):
            response = await self.request("POST", path + "/quiz", {"revision": 1, "answers": answers}, user=2)
            self.assertEqual(response.status_code, 422, response.text)

    async def test_lesson_attachment_and_completion(self):
        article = await self.create(questions=[])
        path = f'/articles/{article["id"]}'
        resources = (await self.request("GET", "/admin/group-plan/resources")).json()
        self.assertEqual(resources["articles"][0]["id"], article["id"])
        body = {"title": "Lesson", "lesson_at": "2026-09-15T10:00:00Z", "status": "published", "items": [{"section": "lesson", "article_id": article["id"]}]}
        response = await self.request("POST", "/admin/groups/1/lessons", body)
        self.assertEqual(response.status_code, 201, response.text)
        lesson_id = response.json()["id"]
        plan = (await self.request("GET", "/group-plan", user=2)).json()
        self.assertEqual(plan[0]["items"][0]["resource_type"], "article")
        self.assertEqual(plan[0]["items"][0]["completion_status"], "not_started")
        response = await self.request("POST", path + "/read", {"revision": 1}, user=2)
        self.assertTrue(response.json()["completed"])
        plan = (await self.request("GET", "/group-plan", user=2)).json()
        self.assertEqual(plan[0]["items"][0]["progress_percent"], 100)
        self.assertEqual(plan[0]["items"][0]["completion_status"], "completed")
        self.assertEqual((await self.request("DELETE", f'/admin/articles/{article["id"]}')).status_code, 409)
        article["published"] = False
        await self.request("PUT", f'/admin/articles/{article["id"]}', article)
        plan = (await self.request("GET", "/group-plan", user=2)).json()
        self.assertEqual(plan[0]["items"], [])
        body["items"] = []
        self.assertEqual((await self.request("PUT", f"/admin/group-lessons/{lesson_id}", body)).status_code, 200)
        self.assertEqual((await self.request("DELETE", f'/admin/articles/{article["id"]}')).status_code, 200)

    async def test_revisions_prevent_stale_results(self):
        article = await self.create(questions=[])
        path = f'/articles/{article["id"]}'
        await self.request("POST", path + "/read", {"revision": 1}, user=2)
        article["content"] = "Updated content"
        response = await self.request("PUT", f'/admin/articles/{article["id"]}', article)
        self.assertEqual(response.json()["revision"], 2)
        self.assertEqual((await self.request("PUT", f'/admin/articles/{article["id"]}', article)).status_code, 409)
        self.assertFalse((await self.request("GET", path, user=2)).json()["progress"]["completed"])
        self.assertEqual((await self.request("POST", path + "/read", {"revision": 1}, user=2)).status_code, 409)
        self.assertEqual((await self.request("POST", path + "/quiz", {"revision": 1, "answers": []}, user=2)).status_code, 409)
        self.assertTrue((await self.request("POST", path + "/read", {"revision": 2}, user=2)).json()["completed"])

    async def test_invalid_article_and_attachment_payloads(self):
        for patch in ({"title": "   "}, {"content": " ", "published": True}, {"questions": [{**QUESTIONS[0], "correct_answers": [3]}]}, {"questions": [{**QUESTIONS[0], "correct_answers": [0, 1]}]}, {"questions": [{**QUESTIONS[1], "correct_answers": []}]}, {"questions": [{**QUESTIONS[2], "options": ["A", "B"]}]}):
            response = await self.request("POST", "/admin/articles", {"title": "Article", "content": "Text", **patch})
            self.assertEqual(response.status_code, 422, response.text)
        for item in ({"article_id": 999}, {"article_id": 1, "topic_id": 1}, {}):
            response = await self.request("POST", "/admin/groups/1/lessons", {"title": "Lesson", "lesson_at": "2026-09-15T10:00:00Z", "items": [{"section": "lesson", **item}]})
            self.assertIn(response.status_code, (400, 422), response.text)

    async def test_html_round_trip_and_markdown_default(self):
        html = '<!DOCTYPE html><html lang="ru"><head><style>.diagram { color: red; }</style></head><body><h1>Кодировки</h1><div class="diagram">0101</div></body></html>'
        article = await self.create(content=html, content_format="html")
        self.assertEqual(article["content"], html)
        self.assertEqual(article["content_format"], "html")
        public = (await self.request("GET", f'/articles/{article["id"]}', user=2)).json()
        self.assertEqual(public["content"], html)
        self.assertEqual(public["content_format"], "html")
        self.assertEqual(len(public["questions"]), 3)
        article["content"] = html.replace('0101', '1111')
        updated = await self.request("PUT", f'/admin/articles/{article["id"]}', article)
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["content_format"], "html")
        self.assertEqual(updated.json()["content"], article["content"])
        markdown = await self.create()
        self.assertEqual(markdown["content_format"], "markdown")
        invalid = await self.request("POST", "/admin/articles", {"title": "Test", "content_format": "xml"})
        self.assertEqual(invalid.status_code, 422)

    async def test_four_lesson_sections_multiple_topics_and_separate_quiz_progress(self):
        article = await self.create()
        async with self.sessions() as db:
            db.add_all([Topic(id=1, title="Topic one"), Topic(id=2, title="Topic two")])
            await db.commit()
        items = [
            {"section": "theory", "article_id": article["id"]},
            {"section": "testing", "article_id": article["id"], "article_mode": "quiz"},
            {"section": "lesson", "topic_id": 1}, {"section": "lesson", "topic_id": 2},
            {"section": "homework", "topic_id": 1}, {"section": "homework", "topic_id": 2},
            {"section": "homework", "article_id": article["id"], "article_mode": "quiz"},
        ]
        body = {"title": "Complete lesson", "lesson_at": "2026-09-16T10:00:00Z", "homework_deadline": "2026-09-23T10:00:00Z", "status": "published", "items": items}
        response = await self.request("POST", "/admin/groups/1/lessons", body)
        self.assertEqual(response.status_code, 201, response.text)
        lesson = response.json()
        self.assertEqual(len(lesson["items"]), 7)
        self.assertEqual([item["resource_type"] for item in lesson["items"]], ["article", "quiz", "topic", "topic", "topic", "topic", "quiz"])
        self.assertIn("mode=theory", lesson["items"][0]["href"])
        self.assertIn("mode=quiz", lesson["items"][1]["href"])
        resources = (await self.request("GET", "/admin/group-plan/resources")).json()
        self.assertEqual(resources["articles"][0]["question_count"], 3)
        await self.request("POST", f'/articles/{article["id"]}/read', {"revision": 1}, user=2)
        plan = (await self.request("GET", "/group-plan", user=2)).json()[0]["items"]
        self.assertEqual(plan[0]["completion_status"], "completed")
        self.assertEqual(plan[0]["total"], 1)
        self.assertEqual(plan[1]["completion_status"], "not_started")
        self.assertEqual(plan[1]["solved"], 0)
        await self.request("POST", f'/articles/{article["id"]}/quiz', {"revision": 1, "answers": [[1], [0], [0]]}, user=2)
        plan = (await self.request("GET", "/group-plan", user=2)).json()[0]["items"]
        self.assertEqual(plan[1]["completion_status"], "in_progress")
        self.assertEqual(plan[1]["solved"], 2)
        self.assertEqual(plan[1]["total"], 3)
        self.assertEqual(plan[-1]["section"], "homework")
        self.assertEqual(plan[-1]["solved"], 2)
        await self.request("POST", f'/articles/{article["id"]}/quiz', {"revision": 1, "answers": [[1], [0, 2], [0]]}, user=2)
        plan = (await self.request("GET", "/group-plan", user=2)).json()[0]["items"]
        self.assertEqual(plan[1]["completion_status"], "completed")
        self.assertEqual(plan[-1]["completion_status"], "completed")
        response = await self.request("PUT", f'/admin/group-lessons/{lesson["id"]}', body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()["items"]), 7)
        article["questions"] = []
        self.assertEqual((await self.request("PUT", f'/admin/articles/{article["id"]}', article)).status_code, 409)

    async def test_reject_invalid_theory_and_quiz_assignments(self):
        article = await self.create(questions=[])
        for item, status in [
            ({"section": "theory", "topic_id": 1}, 422),
            ({"section": "testing", "article_id": article["id"]}, 422),
            ({"section": "theory", "article_id": article["id"], "article_mode": "quiz"}, 422),
            ({"section": "homework", "topic_id": 1, "article_mode": "quiz"}, 422),
            ({"section": "testing", "article_id": article["id"], "article_mode": "quiz"}, 400),
            ({"section": "homework", "article_id": article["id"], "article_mode": "quiz"}, 400),
        ]:
            response = await self.request("POST", "/admin/groups/1/lessons", {"title": "Lesson", "lesson_at": "2026-09-16T10:00:00Z", "items": [item]})
            self.assertEqual(response.status_code, status, response.text)


if __name__ == "__main__":
    unittest.main()
