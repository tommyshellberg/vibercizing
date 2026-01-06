# Contributing

Pull requests welcome.

## Development Setup

1. Fork and clone the repo
2. Follow the Quick Start in README.md
3. Make your changes
4. Run tests before submitting

## Running Tests

```bash
# Server
cd server && uv run pytest

# Client
cd client && npm test
```

## Code Style

- Python: Follow existing patterns, use type hints
- TypeScript: ESLint rules in `eslint.config.js`
- Keep functions small and focused
- Write tests for new functionality

## Adding Exercises

To add a new exercise type:

1. Add configuration in `server/server/exercises.py`
2. Create detector in `client/src/lib/exercises.ts`
3. Add tests for detection logic
4. Update UI to support exercise selection (optional)

## Pull Requests

- Keep PRs focused on a single change
- Include tests for new features
- Update README if adding user-facing features
