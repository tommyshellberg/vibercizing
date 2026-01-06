"""Tests for WebSocket functionality."""

import pytest
from starlette.testclient import TestClient

import server.main as main_module
from server.main import app
from server.database import Database


@pytest.fixture
async def db(tmp_path) -> Database:
    """Create a fresh database for each test."""
    db_path = tmp_path / "test.db"
    database = Database(db_path)
    await database.init()
    return database


@pytest.fixture
def client(db: Database) -> TestClient:
    """Create test client with mocked database."""
    # Set the global _db directly for WebSocket endpoints
    original_db = main_module._db
    main_module._db = db
    yield TestClient(app)
    main_module._db = original_db


class TestWebSocket:
    """Tests for WebSocket endpoint."""

    def test_connect_and_receive_balance(self, client: TestClient) -> None:
        with client.websocket_connect("/ws") as ws:
            data = ws.receive_json()
            assert data["type"] == "balance_update"
            assert data["requests_available"] == 0

    def test_exercise_complete_credits_request(
        self, client: TestClient, db: Database
    ) -> None:
        with client.websocket_connect("/ws") as ws:
            # Receive initial balance
            ws.receive_json()

            # Send exercise complete
            ws.send_json({
                "type": "exercise_complete",
                "exercise": "jumping_jacks",
                "reps": 20,
            })

            # Should receive request_awarded
            awarded = ws.receive_json()
            assert awarded["type"] == "request_awarded"
            assert awarded["exercise"] == "jumping_jacks"
            assert awarded["requests"] == 1

            # Should receive balance_update
            balance = ws.receive_json()
            assert balance["type"] == "balance_update"
            assert balance["requests_available"] == 1

    def test_insufficient_reps_not_credited(
        self, client: TestClient, db: Database
    ) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # Initial balance

            # Send incomplete exercise (only 10 reps, need 20)
            ws.send_json({
                "type": "exercise_complete",
                "exercise": "jumping_jacks",
                "reps": 10,
            })

            # Should receive error message
            response = ws.receive_json()
            assert response["type"] == "error"
            assert "10" in response["message"]  # Should mention the reps needed

    def test_unknown_exercise_returns_error(
        self, client: TestClient, db: Database
    ) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # Initial balance

            ws.send_json({
                "type": "exercise_complete",
                "exercise": "unknown_exercise",
                "reps": 20,
            })

            response = ws.receive_json()
            assert response["type"] == "error"
