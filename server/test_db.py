import asyncio
import asyncpg
import sys

async def test_conn():
    try:
        # Try to connect to postgres (the default DB) first to see if service is up
        conn = await asyncpg.connect(user='postgres', password='postgres', host='localhost', port=5432)
        print("Successfully connected to 'postgres' database.")
        
        # Check if edu_platform exists
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname='edu_platform'")
        if exists:
            print("Database 'edu_platform' exists.")
        else:
            print("Database 'edu_platform' DOES NOT EXIST. Please create it: CREATE DATABASE edu_platform;")
            
        await conn.close()
    except Exception as e:
        print(f"FAILED TO CONNECT: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
