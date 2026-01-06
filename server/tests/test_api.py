"""Tests for REST API endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from server.main import app, get_db
from server.database import Database


@pytest.fixture
async def db(tmp_path) -> Database:
    """Create a fresh database for each test."""
    db_path = tmp_path / "test.db"
    database = Database(db_path)
    await database.init()
    return database


@pytest.fixture
async def client(db: Database) -> AsyncClient:
    """Create test client with overridden database."""
    app.dependency_overrides[get_db] = lambda: db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


class TestBalanceEndpoint:
    """Tests for GET /api/balance."""

    async def test_returns_zero_initially(self, client: AsyncClient) -> None:
        response = await client.get("/api/balance")
        assert response.status_code == 200
        data = response.json()
        assert data["requests_available"] == 0
        assert data["requests_earned"] == 0
        assert data["requests_spent"] == 0

    async def test_reflects_credited_requests(
        self, client: AsyncClient, db: Database
    ) -> None:
        await db.credit_requests(5)
        response = await client.get("/api/balance")
        assert response.status_code == 200
        data = response.json()
        assert data["requests_available"] == 5
        assert data["requests_earned"] == 5


class TestDeductEndpoint:
    """Tests for POST /api/deduct."""

    async def test_deduct_fails_with_no_balance(self, client: AsyncClient) -> None:
        response = await client.post("/api/deduct")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["requests_available"] == 0
        assert "error" in data

    async def test_deduct_succeeds_with_balance(
        self, client: AsyncClient, db: Database
    ) -> None:
        await db.credit_requests(3)
        response = await client.post("/api/deduct")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["requests_remaining"] == 2

    async def test_deduct_decrements_balance(
        self, client: AsyncClient, db: Database
    ) -> None:
        await db.credit_requests(2)
        await client.post("/api/deduct")
        await client.post("/api/deduct")
        response = await client.post("/api/deduct")
        assert response.json()["success"] is False


class TestHistoryEndpoint:
    """Tests for GET /api/history."""

    async def test_returns_empty_history_initially(self, client: AsyncClient) -> None:
        response = await client.get("/api/history")
        assert response.status_code == 200
        data = response.json()
        assert data["exercises"] == []
        assert data["requests"] == []

    async def test_returns_exercise_history(
        self, client: AsyncClient, db: Database
    ) -> None:
        await db.log_exercise("jumping_jacks", reps=20, requests_awarded=1)
        response = await client.get("/api/history")
        data = response.json()
        assert len(data["exercises"]) == 1
        assert data["exercises"][0]["exercise_type"] == "jumping_jacks"

    async def test_returns_request_history(
        self, client: AsyncClient, db: Database
    ) -> None:
        await db.credit_requests(1)
        await db.deduct_request()
        response = await client.get("/api/history")
        data = response.json()
        assert len(data["requests"]) == 1
        assert data["requests"][0]["blocked"] is False


class TestResetEndpoint:
    """Tests for POST /api/reset."""

    async def test_reset_clears_balance(
        self, client: AsyncClient, db: Database
    ) -> None:
        await db.credit_requests(10)
        response = await client.post("/api/reset")
        assert response.status_code == 200
        assert response.json()["success"] is True

        balance_response = await client.get("/api/balance")
        assert balance_response.json()["requests_available"] == 0

    async def test_reset_clears_history(
        self, client: AsyncClient, db: Database
    ) -> None:
        await db.log_exercise("jumping_jacks", reps=20, requests_awarded=1)
        await client.post("/api/reset")
        history_response = await client.get("/api/history")
        assert history_response.json()["exercises"] == []
