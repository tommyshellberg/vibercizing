"""Database layer using aiosqlite."""

from datetime import datetime
from pathlib import Path

import aiosqlite

from server.models import Balance, ExerciseLogEntry, RequestLogEntry


SCHEMA = """
CREATE TABLE IF NOT EXISTS balance (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    requests_earned INTEGER NOT NULL DEFAULT 0,
    requests_spent INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercise_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_type TEXT NOT NULL,
    reps_completed INTEGER NOT NULL,
    requests_awarded INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requests_deducted INTEGER NOT NULL DEFAULT 1,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


class Database:
    """Async database operations for vibercizing."""

    def __init__(self, db_path: Path | str) -> None:
        self.db_path = Path(db_path)

    async def init(self) -> None:
        """Initialize database schema."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.db_path) as conn:
            await conn.executescript(SCHEMA)
            await conn.execute(
                "INSERT OR IGNORE INTO balance (id, requests_earned, requests_spent) "
                "VALUES (1, 0, 0)"
            )
            await conn.commit()

    async def get_balance(self) -> Balance:
        """Get current balance."""
        async with aiosqlite.connect(self.db_path) as conn:
            cursor = await conn.execute(
                "SELECT requests_earned, requests_spent FROM balance WHERE id = 1"
            )
            row = await cursor.fetchone()
            if row is None:
                return Balance(requests_available=0, requests_earned=0, requests_spent=0)
            earned, spent = row
            return Balance(
                requests_available=earned - spent,
                requests_earned=earned,
                requests_spent=spent,
            )

    async def credit_requests(self, amount: int) -> None:
        """Credit requests to balance."""
        async with aiosqlite.connect(self.db_path) as conn:
            await conn.execute(
                "UPDATE balance SET requests_earned = requests_earned + ?, "
                "updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                (amount,),
            )
            await conn.commit()

    async def deduct_request(self) -> bool:
        """
        Attempt to deduct one request.
        Returns True if successful, False if insufficient balance.
        Always logs the attempt.
        """
        async with aiosqlite.connect(self.db_path) as conn:
            cursor = await conn.execute(
                "SELECT requests_earned, requests_spent FROM balance WHERE id = 1"
            )
            row = await cursor.fetchone()
            if row is None:
                return False

            earned, spent = row
            available = earned - spent

            if available <= 0:
                await conn.execute(
                    "INSERT INTO request_log (requests_deducted, blocked) VALUES (1, TRUE)"
                )
                await conn.commit()
                return False

            await conn.execute(
                "UPDATE balance SET requests_spent = requests_spent + 1, "
                "updated_at = CURRENT_TIMESTAMP WHERE id = 1"
            )
            await conn.execute(
                "INSERT INTO request_log (requests_deducted, blocked) VALUES (1, FALSE)"
            )
            await conn.commit()
            return True

    async def log_exercise(
        self, exercise_type: str, reps: int, requests_awarded: int
    ) -> None:
        """Log an exercise session."""
        async with aiosqlite.connect(self.db_path) as conn:
            await conn.execute(
                "INSERT INTO exercise_log (exercise_type, reps_completed, requests_awarded) "
                "VALUES (?, ?, ?)",
                (exercise_type, reps, requests_awarded),
            )
            await conn.commit()

    async def get_exercise_history(self) -> list[ExerciseLogEntry]:
        """Get exercise history."""
        async with aiosqlite.connect(self.db_path) as conn:
            conn.row_factory = aiosqlite.Row
            cursor = await conn.execute(
                "SELECT id, exercise_type, reps_completed, requests_awarded, created_at "
                "FROM exercise_log ORDER BY created_at DESC"
            )
            rows = await cursor.fetchall()
            return [
                ExerciseLogEntry(
                    id=row["id"],
                    exercise_type=row["exercise_type"],
                    reps_completed=row["reps_completed"],
                    requests_awarded=row["requests_awarded"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
                for row in rows
            ]

    async def get_request_history(self) -> list[RequestLogEntry]:
        """Get request history."""
        async with aiosqlite.connect(self.db_path) as conn:
            conn.row_factory = aiosqlite.Row
            cursor = await conn.execute(
                "SELECT id, requests_deducted, blocked, created_at "
                "FROM request_log ORDER BY created_at DESC"
            )
            rows = await cursor.fetchall()
            return [
                RequestLogEntry(
                    id=row["id"],
                    requests_deducted=row["requests_deducted"],
                    blocked=bool(row["blocked"]),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
                for row in rows
            ]

    async def reset(self) -> None:
        """Reset all data (balance and history)."""
        async with aiosqlite.connect(self.db_path) as conn:
            await conn.execute(
                "UPDATE balance SET requests_earned = 0, requests_spent = 0, "
                "updated_at = CURRENT_TIMESTAMP WHERE id = 1"
            )
            await conn.execute("DELETE FROM exercise_log")
            await conn.execute("DELETE FROM request_log")
            await conn.commit()
