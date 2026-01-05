# Vibercizing - Design Document

> Earn Claude Code requests through exercise. No exercise, no code generation.

## Overview

Vibercizing is a Claude Code plugin that gates LLM requests behind physical exercise. Before each message you send to Claude, the system checks if you have "requests" available. If not, you must complete an exercise (detected via webcam) to earn more.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Machine                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐         ┌──────────────────────────────────┐ │
│   │ Claude Code  │         │      Browser Client              │ │
│   │   + Plugin   │         │  (React + MediaPipe)             │ │
│   └──────┬───────┘         └──────────────┬───────────────────┘ │
│          │                                 │                     │
│          │ HTTP                            │ WebSocket           │
│          │ (deduct request)                │ (exercise events,   │
│          │                                 │  balance updates)   │
│          │                                 │                     │
│          ▼                                 ▼                     │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              Python Backend (FastAPI)                     │  │
│   │                                                           │  │
│   │  ┌─────────────┐    ┌─────────────┐                      │  │
│   │  │    REST     │    │  WebSocket  │                      │  │
│   │  │    API      │    │   Server    │                      │  │
│   │  └──────┬──────┘    └──────┬──────┘                      │  │
│   │         │                  │                              │  │
│   │         └────────┬─────────┘                              │  │
│   │                  ▼                                        │  │
│   │           ┌─────────────┐                                 │  │
│   │           │   SQLite    │                                 │  │
│   │           │  Database   │                                 │  │
│   │           └─────────────┘                                 │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**

1. You send a message in Claude Code → Plugin hook fires
2. Hook calls FastAPI server → "Do I have requests?"
3. If no → Block with error message, you go exercise
4. Browser client detects exercise via MediaPipe → Sends completion to WebSocket
5. Server credits request → Balance updates in real-time
6. You retry in Claude Code → Request deducted → Message proceeds

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Blocking behavior | Hard block | Maximum accountability, simplest to implement |
| ML location | Browser (MediaPipe) | Privacy (video stays local), instant feedback, simpler architecture |
| Request earning model | Exercise-goal (complete a set = 1 request) | Most motivating, prevents gaming with half-reps |
| Starting balance | 0 requests | Maximum accountability from the start |
| Client stack | React + Vite + shadcn + Tailwind + Zustand | Production-ready, testable, good DX |
| Server stack | FastAPI + aiosqlite | Async-native, WebSocket support, auto-generated docs |
| Database | SQLite | Single file, proper schema, handles concurrent reads |
| Real-time communication | WebSocket | Instant feedback for exercise completion and balance updates |
| When blocked | Simple error message | Less magic, user keeps exercise client open in browser |

## Exercise Configuration

| Exercise | Reps Required | Requests Earned |
|----------|---------------|-----------------|
| Jumping jacks | 20 | 1 |
| Pushups | 10 | 1 |
| Burpees | 5 | 1 |

## Project Structure

```
vibercizing/
├── README.md
├── plugin/                     # Claude Code Plugin
│   ├── .claude-plugin/
│   │   └── plugin.json         # Plugin manifest
│   ├── hooks/
│   │   ├── hooks.json          # Hook configuration
│   │   └── scripts/
│   │       └── check-requests.py
│   └── .mcp.json               # MCP server config (optional)
│
├── client/                     # React + Vite App
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── WebcamFeed.tsx      # Webcam + MediaPipe overlay
│   │   │   ├── ExerciseDetector.tsx # Pose → exercise logic
│   │   │   ├── RepCounter.tsx       # Current rep count display
│   │   │   └── RequestBalance.tsx   # Earned/spent display
│   │   ├── lib/
│   │   │   ├── mediapipe.ts        # MediaPipe setup
│   │   │   ├── exercises.ts        # Exercise detection logic
│   │   │   └── websocket.ts        # WebSocket client
│   │   └── store/
│   │       └── useStore.ts         # Zustand store
│   └── tests/
│       └── exercises.test.ts       # Exercise detection tests
│
├── server/                     # Python Backend
│   ├── pyproject.toml          # Dependencies (uv/poetry)
│   ├── server/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app + WebSocket
│   │   ├── database.py         # SQLite + aiosqlite
│   │   └── models.py           # Pydantic models
│   └── tests/
│       └── test_server.py
│
└── data/
    └── vibercizing.db          # SQLite database (gitignored)
```

## Database Schema

```sql
-- Core balance tracking
CREATE TABLE balance (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Single row
    requests_earned INTEGER NOT NULL DEFAULT 0,
    requests_spent INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exercise history (for stats/debugging)
CREATE TABLE exercise_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_type TEXT NOT NULL,           -- 'jumping_jacks', 'pushups', 'burpees'
    reps_completed INTEGER NOT NULL,
    requests_awarded INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Request history (for stats/debugging)
CREATE TABLE request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requests_deducted INTEGER NOT NULL DEFAULT 1,
    blocked BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE if request was blocked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key points:**
- `balance` table has a single row (enforced by `CHECK` constraint)
- Available requests = `requests_earned - requests_spent`
- History tables enable future stats ("you did 500 jumping jacks this week")

## Exercise Detection Logic

The browser client uses MediaPipe Pose to detect 33 body landmarks at 30+ FPS, then applies exercise-specific state machines.

### Landmark Positions

```
        0 (nose)
          │
    11 ───┼─── 12   (shoulders)
          │
    13    │    14   (elbows)
          │
    15    │    16   (wrists)
          │
    23 ───┼─── 24   (hips)
          │
    25    │    26   (knees)
          │
    27    │    28   (ankles)
```

### Jumping Jacks

```
State machine:
- "down" state: wrists below shoulders (y-coordinate), feet close together
- "up" state: wrists above head, feet spread apart (x-distance > threshold)
- Rep counts on transition: down → up → down (full cycle)
```

### Pushups

```
State machine:
- Calculate elbow angle (shoulder → elbow → wrist)
- "up" state: elbow angle > 160° (arms extended)
- "down" state: elbow angle < 90° (arms bent)
- Rep counts on transition: up → down → up (full cycle)
```

### Burpees

```
State machine (simplified):
- Track hip height relative to standing baseline
- "standing" → "squat" → "plank" → "squat" → "jump" → "standing"
- Rep counts on full cycle completion
```

### Stability Filtering

Ignore frames where landmarks jump erratically (person partially off-screen or too close to camera). Check velocity of landmark positions between frames.

## API Design

### REST Endpoints (FastAPI)

```
GET  /api/balance
Response: {
    "requests_available": 3,
    "requests_earned": 10,
    "requests_spent": 7
}

POST /api/deduct
Response (success): {
    "success": true,
    "requests_remaining": 2
}
Response (failure): {
    "success": false,
    "requests_available": 0,
    "error": "Insufficient requests. Exercise to earn more!"
}

GET  /api/history
Response: {
    "exercises": [...],
    "requests": [...]
}

POST /api/reset
Response: { "success": true }
```

### WebSocket Messages

```typescript
// Client → Server: Exercise completed
{
    "type": "exercise_complete",
    "exercise": "jumping_jacks",
    "reps": 20
}

// Server → Client: Balance update
{
    "type": "balance_update",
    "requests_available": 4,
    "requests_earned": 11,
    "requests_spent": 7
}

// Server → Client: Request awarded confirmation
{
    "type": "request_awarded",
    "exercise": "jumping_jacks",
    "requests": 1,
    "message": "Nice! +1 request for 20 jumping jacks"
}
```

## Claude Code Plugin

### Plugin Manifest (`.claude-plugin/plugin.json`)

```json
{
  "name": "vibercizing",
  "version": "1.0.0",
  "description": "Earn Claude requests through exercise",
  "hooks": "./hooks/hooks.json"
}
```

### Hooks Config (`hooks/hooks.json`)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/check-requests.py"
          }
        ]
      }
    ]
  }
}
```

### Hook Script (`hooks/scripts/check-requests.py`)

```python
#!/usr/bin/env python3
import json
import sys
import urllib.request

try:
    req = urllib.request.Request(
        "http://localhost:8000/api/deduct",
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        result = json.load(resp)

    if result.get("success"):
        sys.exit(0)  # Allow the request
    else:
        output = {
            "decision": "block",
            "reason": (
                "❌ No requests available!\n\n"
                "You need to exercise to earn requests.\n"
                "Open http://localhost:5173 to start.\n\n"
                f"Current balance: {result.get('requests_available', 0)} requests"
            )
        }
        print(json.dumps(output))
        sys.exit(0)

except Exception as e:
    output = {
        "decision": "block",
        "reason": (
            "❌ Vibercizing server not running!\n\n"
            "Start it with: cd server && python -m server.main"
        )
    }
    print(json.dumps(output))
    sys.exit(0)
```

## References

- [MediaPipe Pose Detection (Browser)](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker/)
- [DEV.to: Fitness App with MediaPipe + React](https://dev.to/yoshan0921/fitness-app-development-with-real-time-posture-detection-using-mediapipe-38do)
- [GitHub: Activities-Pose-Estimation](https://github.com/hugozanini/Activities-Pose-Estimation)
- [TensorFlow.js Pose Detection Models](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection)
- [Claude Code Plugins Reference](https://docs.anthropic.com/en/docs/claude-code/plugins)
