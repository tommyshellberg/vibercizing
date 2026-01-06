"""Exercise configuration and validation."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ExerciseConfig:
    """Configuration for an exercise type."""

    name: str
    display_name: str
    reps_required: int
    requests_awarded: int


EXERCISES: dict[str, ExerciseConfig] = {
    "jumping_jacks": ExerciseConfig(
        name="jumping_jacks",
        display_name="Jumping Jacks",
        reps_required=20,
        requests_awarded=1,
    ),
}


def get_exercise_config(exercise_name: str) -> ExerciseConfig | None:
    """Get configuration for an exercise by name."""
    return EXERCISES.get(exercise_name)


def validate_exercise_completion(
    exercise_name: str, reps: int
) -> tuple[bool, str, int]:
    """
    Validate if an exercise completion meets requirements.

    Returns:
        tuple of (success, message, requests_awarded)
    """
    config = get_exercise_config(exercise_name)
    if config is None:
        return False, f"Unknown exercise: {exercise_name}", 0

    if reps < config.reps_required:
        return (
            False,
            f"Need {config.reps_required} reps, got {reps}",
            0,
        )

    return True, f"Completed {config.display_name}!", config.requests_awarded
