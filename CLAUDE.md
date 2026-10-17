# CLAUDE.md — Soncrant Arcade (games portal)

Read the planning docs in the `star-destroyer` repo first (`PROJECT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CLAUDE.md`). Their workflow, quality and security rules apply here too.

## This repo owns

- The portal home page at `games.soncrant.com/` (server folder `/var/www/html/soncrant.com/pub/games/`, top level only).
- One entry file per game in `games/<slug>.json` (from milestone T1). A PR adding a game's entry is how a game claims its name and URL.
- The security-header configuration supplied to the owner for the `games/` folder.

## Scope boundary

- Change files only inside this repo. Never edit a game's repo or a game's server subfolder.
- The release script for this repo deploys only the portal's own files at the top of `games/`, and never deletes or overwrites a game's subfolder.
- Apache configuration is managed by the owner. Propose changes; don't apply them.

## Always ask the owner before

Architecture or scope changes, new dependencies, destructive operations, any production deployment, and security decisions.

## Git

Never push to `main` or merge PRs. One task per branch (`feature/<roadmap-id>-<short-name>`), with test evidence in every PR.
