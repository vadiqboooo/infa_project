"""Topic layout persistence and public navigation contract, using isolated SQLite."""
import unittest

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.database import Base
from app.dependencies import get_current_user, get_db, verify_parser_api_key
from app.models.user import User
from app.routers import admin, content


@compiles(JSONB, "sqlite")
def sqlite_jsonb(element, compiler, **kw):
    return "JSON"


class TopicLayoutTests(unittest.IsolatedAsyncioTestCase):
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

        app = FastAPI()
        app.dependency_overrides[get_db] = test_db
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[verify_parser_api_key] = lambda: None
        app.include_router(admin.router)
        app.include_router(content.router)
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.engine.dispose()

    async def test_layout_round_trip_and_navigation(self):
        body = {"title": "Vertical topic", "task_layout": "vertical"}
        response = await self.client.post("/topics", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        topic = response.json()
        self.assertEqual(topic["task_layout"], "vertical")
        listed = await self.client.get("/topics")
        self.assertEqual(listed.json()[0]["task_layout"], "vertical")
        navigation = await self.client.get("/navigation")
        self.assertEqual(navigation.status_code, 200, navigation.text)
        self.assertEqual(navigation.json()[0]["task_layout"], "vertical")
        response = await self.client.put(f'/topics/{topic["id"]}', json={**body, "task_layout": "single"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["task_layout"], "single")
        self.assertEqual((await self.client.get("/navigation")).json()[0]["task_layout"], "single")

    async def test_default_and_legacy_update_preserve_layout(self):
        response = await self.client.post("/topics", json={"title": "Default"})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["task_layout"], "single")
        topic_id = response.json()["id"]
        await self.client.put(f'/topics/{topic_id}', json={"title": "Default", "task_layout": "vertical"})
        response = await self.client.put(f'/topics/{topic_id}', json={"title": "Renamed"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["task_layout"], "vertical")

    async def test_reject_unknown_layout(self):
        response = await self.client.post("/topics", json={"title": "Invalid", "task_layout": "grid"})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
