#!/usr/bin/env python3
"""Print the slug of every live game, one per line, from games/<slug>.json.

Used by scripts/release.sh and the Production check workflow to know which
game folders to smoke test. The full rules live in src/logic/games.ts.
"""
import json
import pathlib
import sys

GAMES = pathlib.Path(__file__).resolve().parent.parent / "games"


def main() -> int:
    for path in sorted(GAMES.glob("*.json")):
        game = json.loads(path.read_text(encoding="utf-8"))
        if game.get("status") == "live":
            print(game["slug"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
