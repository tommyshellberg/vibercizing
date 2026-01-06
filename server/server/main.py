"""FastAPI application for Vibercizing."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from server.database import Database
from server.exercises import validate_exercise_completion
from server.models import Balance, DeductResponse


DATA_DIR = Path(__file__).parent.parent.parent / "data"
DB_PATH = DATA_DIR / "vibercizing.db"

_db: Database | None = None


def get_db() -> Database:
    """Dependency to get the database instance."""
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    global _db
    _db = Database(DB_PATH)
    await _db.init()
    yield
    _db = None


app = FastAPI(
    title="Vibercizing API",
    description="Earn Claude Code requests through exercise",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when using "*"
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/balance", response_model=Balance)
async def get_balance(db: Annotated[Database, Depends(get_db)]) -> Balance:
    """Get current request balance."""
    return await db.get_balance()


@app.post("/api/deduct", response_model=DeductResponse)
async def deduct_request(db: Annotated[Database, Depends(get_db)]) -> DeductResponse:
    """Attempt to deduct one request."""
    success = await db.deduct_request()
    balance = await db.get_balance()

    if success:
        return DeductResponse(
            success=True,
            requests_remaining=balance.requests_available,
        )
    return DeductResponse(
        success=False,
        requests_available=balance.requests_available,
        error="Insufficient requests. Exercise to earn more!",
    )


@app.get("/api/history")
async def get_history(db: Annotated[Database, Depends(get_db)]) -> dict:
    """Get exercise and request history."""
    exercises = await db.get_exercise_history()
    requests = await db.get_request_history()
    return {
        "exercises": [e.model_dump() for e in exercises],
        "requests": [r.model_dump() for r in requests],
    }


@app.post("/api/reset")
async def reset(db: Annotated[Database, Depends(get_db)]) -> dict:
    """Reset all data."""
    await db.reset()
    return {"success": True}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time updates."""
    await websocket.accept()
    db = get_db()

    # Send initial balance
    balance = await db.get_balance()
    await websocket.send_json({
        "type": "balance_update",
        "requests_available": balance.requests_available,
        "requests_earned": balance.requests_earned,
        "requests_spent": balance.requests_spent,
    })

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "exercise_complete":
                exercise = data.get("exercise", "")
                reps = data.get("reps", 0)

                success, message, requests_awarded = validate_exercise_completion(
                    exercise, reps
                )

                if success:
                    await db.credit_requests(requests_awarded)
                    await db.log_exercise(exercise, reps, requests_awarded)

                    await websocket.send_json({
                        "type": "request_awarded",
                        "exercise": exercise,
                        "requests": requests_awarded,
                        "message": f"Nice! +{requests_awarded} request for {reps} {exercise.replace('_', ' ')}",
                    })

                    balance = await db.get_balance()
                    await websocket.send_json({
                        "type": "balance_update",
                        "requests_available": balance.requests_available,
                        "requests_earned": balance.requests_earned,
                        "requests_spent": balance.requests_spent,
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": message,
                    })

    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
