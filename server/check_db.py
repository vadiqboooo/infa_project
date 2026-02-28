"""Check database connection."""
import asyncio
import asyncpg
from app.config import settings


async def check_db():
    # Remove +asyncpg suffix for direct asyncpg connection
    db_url = settings.DATABASE_URL.replace('+asyncpg', '')
    try:
        print(f"Trying to connect to: {db_url}")
        conn = await asyncpg.connect(db_url)
        print("Connection successful!")
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")
        print("\nPossible solutions:")
        print("1. Make sure PostgreSQL is running")
        print("2. Check if database 'edu_platform' exists")
        print("3. Verify username/password in .env file")


if __name__ == "__main__":
    asyncio.run(check_db())
