#!/usr/bin/env python3
"""
Claude Code hook script that checks if the user has available requests.
If not, blocks the message and instructs them to exercise.
"""

import json
import sys
import urllib.request
import urllib.error

SERVER_URL = "http://localhost:8000"
CLIENT_URL = "http://localhost:5173"


def main() -> None:
    try:
        req = urllib.request.Request(
            f"{SERVER_URL}/api/deduct",
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.load(resp)

        if result.get("success"):
            # Request deducted successfully, allow the message
            sys.exit(0)
        else:
            # No requests available
            available = result.get("requests_available", 0)
            output = {
                "decision": "block",
                "reason": (
                    f"No requests available! (Balance: {available})\n\n"
                    "You need to exercise to earn requests.\n"
                    f"Open {CLIENT_URL} and complete 20 jumping jacks to earn 1 request."
                ),
            }
            print(json.dumps(output))
            sys.exit(0)

    except urllib.error.URLError:
        # Server not running
        output = {
            "decision": "block",
            "reason": (
                "Vibercizing server not running!\n\n"
                "Start the server:\n"
                "  cd server && uv run python -m server.main\n\n"
                "Then open the client:\n"
                f"  {CLIENT_URL}"
            ),
        }
        print(json.dumps(output))
        sys.exit(0)

    except Exception as e:
        # Unexpected error - allow the request to not block the user
        output = {
            "decision": "block",
            "reason": f"Vibercizing error: {e}",
        }
        print(json.dumps(output))
        sys.exit(0)


if __name__ == "__main__":
    main()
