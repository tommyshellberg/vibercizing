"""Tests for database layer."""

import pytest
from pathlib import Path
from server.database import Database


@pytest.fixture
async def db(tmp_path: Path) -> Database:
    """Create a fresh database for each test."""
    db_path = tmp_path / "test.db"
    database = Database(db_path)
    await database.init()
    return database


class TestBalance:
    """Tests for balance operations."""

    async def test_initial_balance_is_zero(self, db: Database) -> None:
        balance = await db.get_balance()
        assert balance.requests_available == 0
        assert balance.requests_earned == 0
        assert balance.requests_spent == 0

    async def test_credit_increases_earned(self, db: Database) -> None:
        await db.credit_requests(5)
        balance = await db.get_balance()
        assert balance.requests_earned == 5
        assert balance.requests_available == 5

    async def test_deduct_increases_spent(self, db: Database) -> None:
        await db.credit_requests(3)
        result = await db.deduct_request()
        assert result is True
        balance = await db.get_balance()
        assert balance.requests_spent == 1
        assert balance.requests_available == 2

    async def test_deduct_fails_when_no_balance(self, db: Database) -> None:
        result = await db.deduct_request()
        assert result is False
        balance = await db.get_balance()
        assert balance.requests_spent == 0

    async def test_multiple_credits_accumulate(self, db: Database) -> None:
        await db.credit_requests(2)
        await db.credit_requests(3)
        balance = await db.get_balance()
        assert balance.requests_earned == 5

    async def test_reset_clears_all_balances(self, db: Database) -> None:
        await db.credit_requests(10)
        await db.deduct_request()
        await db.reset()
        balance = await db.get_balance()
        assert balance.requests_available == 0
        assert balance.requests_earned == 0
        assert balance.requests_spent == 0


class TestExerciseLog:
    """Tests for exercise logging."""

    async def test_log_exercise_records_entry(self, db: Database) -> None:
        await db.log_exercise("jumping_jacks", reps=20, requests_awarded=1)
        history = await db.get_exercise_history()
        assert len(history) == 1
        assert history[0].exercise_type == "jumping_jacks"
        assert history[0].reps_completed == 20
        assert history[0].requests_awarded == 1

    async def test_multiple_exercises_logged_in_order(self, db: Database) -> None:
        await db.log_exercise("jumping_jacks", reps=20, requests_awarded=1)
        await db.log_exercise("jumping_jacks", reps=20, requests_awarded=1)
        history = await db.get_exercise_history()
        assert len(history) == 2

    async def test_reset_clears_exercise_history(self, db: Database) -> None:
        await db.log_exercise("jumping_jacks", reps=20, requests_awarded=1)
        await db.reset()
        history = await db.get_exercise_history()
        assert len(history) == 0


class TestRequestLog:
    """Tests for request logging."""

    async def test_deduct_logs_request(self, db: Database) -> None:
        await db.credit_requests(1)
        await db.deduct_request()
        history = await db.get_request_history()
        assert len(history) == 1
        assert history[0].requests_deducted == 1
        assert history[0].blocked is False

    async def test_failed_deduct_logs_blocked(self, db: Database) -> None:
        await db.deduct_request()  # Should fail and log as blocked
        history = await db.get_request_history()
        assert len(history) == 1
        assert history[0].blocked is True

    async def test_reset_clears_request_history(self, db: Database) -> None:
        await db.credit_requests(1)
        await db.deduct_request()
        await db.reset()
        history = await db.get_request_history()
        assert len(history) == 0
