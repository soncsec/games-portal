# Starting a new Soncrant Arcade game

How to start a game that a separate Claude session builds, side by side with the others, without the sessions getting in each other's way (ADR-011). Each game gets its own repo, folder, ports, portal file and server slot.

Commands assume the dev machine layout: repos in `~/dev/games/<slug>/`, the shared art pack in `~/dev/games/_assets/legacy/`, `gh` logged in as `soncsec`, and Node from nvm.

Steps marked **(owner)** need the owner, either to do them or to approve them.

## 1. Choose a name and a port

- **Slug:** lowercase words joined by `-`, for example `rocket-race`. It becomes the repo name (`soncsec/<slug>`), the local folder and the URL (`games.soncrant.com/<slug>/`).
  - Check it's free: no `games/<slug>.json` in this repo and no `soncsec/<slug>` repo.
  - `assets`, `images` and `game-template` are reserved.
- **Title:** what players see, up to 40 characters.
- **Dev port:** unused, from 5171 to 5899. A game from the template also uses port + 1000 (preview) and port + 1001 (Playwright).

  Ports in use:

  | Who | Dev | Preview | Playwright |
  |---|---|---|---|
  | games-portal | 5170 | 4170 | 4171 |
  | star-destroyer | 5173 | 4173 | 4174 |
  | contro | 5174 | 4175 | 4176 |
  | extrat | 5175 | 6175 | 6176 |
  | nuclearwinter | 5177 | 6177 | 6178 |
  | helirescue | 5180 | 6180 | 6181 |
  | game-template (the template itself) | 5190 | 6190 | 6191 |

  Also check `grep -h devPort games/*.json` here, and add your game to this table in step 6.

## 2. Create the repo from the template

```sh
cd ~/dev/games
gh repo create soncsec/<slug> --template soncsec/game-template --public --clone
cd <slug>
ln -s ~/dev/games/_assets/legacy legacy          # the art pack, read-only and git-ignored
cp ~/dev/games/stardestroyer/deploy/server.env deploy/server.env   # release settings (git-ignored)
```

## 3. Protect the repo (owner, or Claude with the owner's OK)

GitHub doesn't copy settings from a template, so set them the same as the other repos:

```sh
gh api -X PUT repos/soncsec/<slug>/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": {"strict": true, "contexts": ["Repo checks", "Build and test", "CodeQL analysis", "CodeQL"]},
  "enforce_admins": true,
  "required_pull_request_reviews": {"dismiss_stale_reviews": true, "require_code_owner_reviews": false, "required_approving_review_count": 0},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
gh api -X PATCH repos/soncsec/<slug> --input - <<'EOF'
{"security_and_analysis": {"secret_scanning": {"status": "enabled"}, "secret_scanning_push_protection": {"status": "enabled"}}}
EOF
gh api -X PUT repos/soncsec/<slug>/vulnerability-alerts
```

## 4. Set up the game (first PR)

```sh
git checkout -b feature/M0.1-init
scripts/init-game.sh <slug> "<Title>" <dev-port>
npm ci
npm run check            # everything CI runs; must pass
git add -A && git commit -m "Set up <Title> from the game template"
git push -u origin feature/M0.1-init
gh pr create --fill
```

`init-game.sh` replaces the template's name, title and ports everywhere, then removes itself. **(owner)** Merge the PR once CI is green.

## 5. Turn on staging (owner approval)

GitHub Pages in Actions mode, deploys from `main` only:

```sh
gh api -X POST repos/soncsec/<slug>/pages -f build_type=workflow
```

The next merge to `main` deploys to `https://soncsec.github.io/<slug>/` and runs the ZAP scan.

## 6. Claim the slug in the portal

Work in a **separate clone** of the portal, never in another session's folder:

```sh
gh repo clone soncsec/games-portal /tmp/portal-<slug> && cd /tmp/portal-<slug>
git checkout -b feature/<slug>-claim
cat > games/<slug>.json <<'EOF'
{
  "slug": "<slug>",
  "title": "<Title>",
  "summary": "One or two sentences, 20 to 200 characters.",
  "tags": ["…"],
  "status": "in-development",
  "devPort": <dev-port>
}
EOF
# also add the game's ports to the table in NEW-GAME.md step 1
npm ci && npm run check
git add -A && git commit -m "Claim <slug> for <Title>" && git push -u origin HEAD && gh pr create --fill
```

`in-development` reserves the URL and shows no card, so no image is needed yet. The portal's tests reject a duplicate slug or port. **(owner)** Merge it.

## 7. Start the game's Claude session

```sh
cd ~/dev/games/<slug> && claude
```

A good first message: *"Read CLAUDE.md, PROJECT.md, ARCHITECTURE.md and ROADMAP.md. Let's agree the game's scope in PROJECT.md before building."*

The session works only inside `~/dev/games/<slug>/`. Shared rules are in its CLAUDE.md.

**One rule worth repeating to every session:** Other games' sessions share this machine. Stop only processes you started, by PID or by your own port (e.g. the pid listening on your Playwright port). Never stop processes by name (`pkill -f vite`, `pkill -f "vite preview"`, `killall node`): that kills other sessions' servers mid-run.

## 8. Later

- **Show the card:** a portal PR (again from a separate clone) adds `public/images/<slug>.png` (256×192) and sets `"status": "coming-soon"`, then `"live"` once released.
- **First production release (owner approval):** `scripts/release.sh deploy` in the game repo. It can only release into `/srv/games-releases/<slug>/` and `games/<slug>`. Then a portal release, so the card appears, and the `Production check` workflow in this repo.
- **Nothing to set up on the server:** the `deploy` user can already create `/srv/games-releases/<slug>/`, and Apache's games config covers every subfolder.
