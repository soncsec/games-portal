# Soncrant Arcade

The games portal for **games.soncrant.com**: a retro-arcade home page with one card per browser game.

- Static site (Vite + TypeScript), no backend, no tracking.
- Each game lives in its own repo and is deployed to its own subfolder of `/var/www/html/soncrant.com/pub/games/`.
- Planning docs (scope, architecture, roadmap) live in [`soncsec/star-destroyer`](https://github.com/soncsec/star-destroyer): see `PROJECT.md`, `ARCHITECTURE.md` (ADR-008, ADR-011) and `ROADMAP.md` (milestone P1).

Status: milestone P1 in progress.

## Adding or editing a game

Each game has **its own file**, `games/<slug>.json`, so sessions building different games never edit the same file (ADR-011). A game's PR touches only its own file and its card image.

```json
{
  "slug": "my-game",
  "title": "My Game",
  "summary": "One or two sentences, 20–200 characters.",
  "image": "images/my-game.png",
  "tags": ["shooter", "arcade"],
  "status": "in-development"
}
```

- **File name = slug.** `games/my-game.json` must contain `"slug": "my-game"`. The game is served at `games.soncrant.com/my-game/`.
- **Slugs:** lowercase words joined by `-`. `assets` and `images` are reserved for the portal.
- **Status:**
  - `in-development` claims the slug and URL but shows no card; the image is optional until then.
  - `coming-soon` shows a greyed-out card.
  - `live` links to the game.
- **Card image:** `public/images/<name>.png`, 256×192.
- Cards are shown live first, then coming soon, each by title. The rules are enforced by `src/logic/games.ts` and its tests.

## Development

```sh
npm ci
npm run dev        # http://localhost:5170
npm run check      # every check CI runs
```

## Releasing to production

Only with the owner's approval for each release.

```sh
cp deploy/server.env.example deploy/server.env   # once; fill in the real values (git-ignored)
git checkout main && git pull
scripts/release.sh deploy --dry-run   # checks and build only; shows what is on the server
scripts/release.sh deploy             # upload, switch, smoke test (rolls back on failure)
scripts/release.sh rollback           # back to the previous release
scripts/release.sh activate <id>      # switch to a specific release (e.g. forward again)
scripts/release.sh status             # list releases on the server
```

On the server the portal is `/srv/games-releases/_portal/<release>/`, linked in as `games/_portal`, with `index.html`, `assets/`, `images/` and `favicon.png` linked through it. Switching `_portal` switches the whole page at once, and game folders are never touched. `deploy` refuses unless HEAD is `origin/main`, the tree is clean, and CI passed on that commit.
