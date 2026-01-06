"""Pydantic models for API and database."""

from datetime import datetime
from pydantic import BaseModel


class Balance(BaseModel):
    """Current balance state."""

    requests_available: int
    requests_earned: int
    requests_spent: int


class ExerciseLogEntry(BaseModel):
    """A logged exercise session."""

    id: int
    exercise_type: str
    reps_completed: int
    requests_awarded: int
    created_at: datetime


class RequestLogEntry(BaseModel):
    """A logged request attempt."""

    id: int
    requests_deducted: int
    blocked: bool
    created_at: datetime


class DeductResponse(BaseModel):
    """Response from deduct endpoint."""

    success: bool
    requests_remaining: int | None = None
    requests_available: int | None = None
    error: str | None = None


class BalanceUpdate(BaseModel):
    """WebSocket message for balance updates."""

    type: str = "balance_update"
    requests_available: int
    requests_earned: int
    requests_spent: int


class RequestAwarded(BaseModel):
    """WebSocket message for request awarded."""

    type: str = "request_awarded"
    exercise: str
    requests: int
    message: str


class ExerciseComplete(BaseModel):
    """WebSocket message from client for exercise completion."""

    type: str = "exercise_complete"
    exercise: str
    reps: int
