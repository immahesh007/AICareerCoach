"""Run all SQL migrations in order. Safe to re-run — every migration is idempotent."""
import asyncio
import os
import pathlib
import asyncpg


async def run():
    url = os.environ["DATABASE_URL"]
    # asyncpg uses postgresql:// not postgresql+asyncpg://
    dsn = url.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(dsn)
    try:
        migrations_dir = pathlib.Path(__file__).parent / "migrations"
        for sql_file in sorted(migrations_dir.glob("*.sql")):
            print(f"Running {sql_file.name} ...", flush=True)
            sql = sql_file.read_text()
            await conn.execute(sql)
            print(f"  OK", flush=True)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
