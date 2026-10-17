# Soncrant Arcade

The games portal for **games.soncrant.com**: a retro-arcade home page with one card per browser game.

- Static site (Vite + TypeScript), no backend, no tracking.
- Each game lives in its own repo and is deployed to its own subfolder of `/var/www/html/soncrant.com/pub/games/`.
- Planning docs (scope, architecture, roadmap) live in [`soncsec/star-destroyer`](https://github.com/soncsec/star-destroyer): see `PROJECT.md`, `ARCHITECTURE.md` (ADR-008, ADR-011) and `ROADMAP.md` (milestone P1).

Status: milestone P1 in progress.

## Adding or editing a game

Edit `games.json` (validated by `src/logic/games.ts`: slug, title, a 20–200 character summary, `images/<name>.png`, up to 4 tags, status `live` or `coming-soon`).

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
scripts/release.sh status             # list releases on the server
```

On the server the portal is `/srv/games-releases/_portal/<release>/`, linked in as `games/_portal`, with `index.html`, `assets/`, `images/` and `favicon.png` linked through it. Switching `_portal` switches the whole page at once, and game folders are never touched. `deploy` refuses unless HEAD is `origin/main`, the tree is clean, and CI passed on that commit.
