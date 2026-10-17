# CLAUDE.md — Soncrant Arcade (games portal)

Read the planning docs in the `star-destroyer` repo first (`PROJECT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CLAUDE.md`). Their workflow, quality and security rules apply here too.

## This repo owns

- The portal home page at `games.soncrant.com/` (server folder `/var/www/html/soncrant.com/pub/games/`, top level only).
- One entry file per game in `games/<slug>.json`. A PR adding a game's entry (status `in-development` at first) is how a game claims its name and URL. A game's session edits only its own entry file and card image here.
- The security-header configuration supplied to the owner for the `games/` folder.

## Scope boundary

- Change files only inside this repo. Never edit a game's repo or a game's server subfolder.
- The release script for this repo deploys only the portal's own files at the top of `games/`, and never deletes or overwrites a game's subfolder.
- Apache configuration is managed by the owner. Propose changes; don't apply them.

## Local ports

Portal dev server **5170**, preview **4170**, Playwright test server **4171**. Games use 5173 and up.

Other games' sessions share this machine. Stop only processes you started, by PID or by your own port (e.g. the pid listening on your Playwright port). Never stop processes by name (`pkill -f vite`, `pkill -f "vite preview"`, `killall node`): that kills other sessions' servers mid-run.

## Checks every PR must pass

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, `npm audit --audit-level=high`. Cards are built with DOM APIs and `textContent`; ESLint forbids `innerHTML`.

Node.js comes from nvm: `export NVM_DIR=$HOME/.nvm; . $NVM_DIR/nvm.sh`.

## Always ask the owner before

Architecture or scope changes, new dependencies, destructive operations, any production deployment, and security decisions.

## Git

Never push to `main` or merge PRs. One task per branch (`feature/<roadmap-id>-<short-name>`), with test evidence in every PR.
