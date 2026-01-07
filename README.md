# Vibercizing

Earn Claude Code requests through physical exercise.

A Claude Code plugin that gates LLM requests behind real exercise. Complete 20 jumping jacks on camera, earn 1 request. No exercise, no AI.

![](jumpingjacks.gif)

## How it Works

1. **Server** tracks your request balance in SQLite
2. **Client** uses MediaPipe to detect jumping jacks via webcam
3. **Plugin** hooks into Claude Code and blocks requests when balance is zero

When you've burned through your requests, you'll see:

```
No requests available! (Balance: 0)

You need to exercise to earn requests.
Open http://localhost:5173 and complete 20 jumping jacks to earn 1 request.
```

## Quick Start

### Prerequisites

- Python 3.13+ with [uv](https://github.com/astral-sh/uv)
- Node.js 18+
- A webcam

### 1. Install Dependencies

```bash
# From repo root
npm install

# Server dependencies
cd server && uv sync && cd ..

# Client dependencies
cd client && npm install && cd ..
```

### 2. Start Development Servers

```bash
# Start both client and server together (from repo root)
npm run dev
```

- Server runs at http://localhost:8000
- Client runs at http://localhost:5173

Or start them individually:

```bash
# Server only (from server/)
uv run serve

# Client only (from client/)
npm run dev
```

### 3. Install the Plugin

Install the plugin via Claude Code:

1. Run `/plugins` to open the plugin manager
2. Add a marketplace source using this repository URL or local path:
   - **Remote**: `https://github.com/tommyshellberg/vibercizing`
   - **Local** (if you cloned the repo): path to the `plugin/` directory
3. Install and activate the vibercizing plugin

The plugin hooks into every message and checks your balance.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Code    │────▶│  Python Server  │◀────│  React Client   │
│  (Plugin Hook)  │     │  (FastAPI)      │     │  (MediaPipe)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │ POST /api/deduct      │ SQLite               │ WebSocket
        │                       │                       │
        ▼                       ▼                       ▼
   Block if 0            Track balance         Detect exercises
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/balance` | GET | Current request balance |
| `/api/deduct` | POST | Deduct 1 request (returns success/failure) |
| `/api/history` | GET | Exercise and request history |
| `/api/reset` | POST | Reset all data |
| `/ws` | WebSocket | Real-time balance updates |

## Development

### Run Tests

```bash
# Server tests
cd server
uv run pytest

# Client tests
cd client
npm test
```

### Project Structure

```
vibercizing/
├── package.json      # Root scripts (npm run dev starts both)
├── server/           # FastAPI backend
│   ├── server/       # Main package
│   │   ├── main.py   # API endpoints + WebSocket
│   │   ├── database.py
│   │   ├── models.py
│   │   └── exercises.py
│   └── tests/
├── client/           # React + Vite frontend
│   └── src/
│       ├── components/
│       ├── lib/      # MediaPipe, exercise detection
│       └── store/    # Zustand state
└── plugin/           # Claude Code plugin
    └── hooks/
        └── scripts/
            └── check-requests.py
```

## Configuration

Exercise requirements are in `server/server/exercises.py`:

```python
EXERCISES = {
    "jumping_jacks": ExerciseConfig(
        name="jumping_jacks",
        reps_per_request=20,
        description="Complete jumping jacks",
    ),
}
```

## Tech Stack

- **Server**: FastAPI, aiosqlite, Pydantic, WebSockets
- **Client**: React 19, Vite, TypeScript, Tailwind, Zustand, MediaPipe
- **Plugin**: Python, Claude Code hooks API

## License

MIT
