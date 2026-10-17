#!/usr/bin/env bash
# Release the Soncrant Arcade portal to production (ADR-009 in the star-destroyer
# repo). Run by the owner, or by
# Claude only with the owner's approval for that release.
#
#   scripts/release.sh deploy [--dry-run]   check, build, upload, switch, smoke test
#   scripts/release.sh rollback             switch back to the previous release
#   scripts/release.sh status               list releases on the server
#
# Settings come from deploy/server.env (git-ignored; see deploy/server.env.example).
set -euo pipefail

SLUG=_portal
REPO=soncsec/games-portal
SITE_HOST=games.soncrant.com
TITLE="Soncrant Arcade"
KEEP=5
REQUIRED_CHECKS=("Repo checks" "Build and test" "CodeQL analysis" "ZAP baseline scan")

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

die() {
  echo "release: $*" >&2
  exit 1
}
step() { printf '\n== %s\n' "$*"; }

# Read KEY=value lines without executing the file.
load_env() {
  local file="deploy/server.env" key value
  [[ -f "$file" ]] || die "$file is missing (copy deploy/server.env.example)"
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z_]+$ ]] || continue
    value="${value%%#*}"
    value="${value%"${value##*[![:space:]]}"}"
    case "$key" in
      SERVER) SERVER="$value" ;;
      SSH_USER) SSH_USER="$value" ;;
      SSH_KEY) SSH_KEY="${value/#\~/$HOME}" ;;
    esac
  done <"$file"
  [[ -n "${SERVER:-}" && -n "${SSH_USER:-}" && -n "${SSH_KEY:-}" ]] ||
    die "$file must set SERVER, SSH_USER and SSH_KEY"
  [[ -f "$SSH_KEY" ]] || die "SSH key not found: $SSH_KEY"
  [[ "$SSH_KEY" != *[[:space:]]* ]] || die "SSH_KEY path must not contain spaces"
  SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10)
}

SSH_OPTS=()

# Runs scripts/release-remote.sh on the server with the given op and arguments.
remote() {
  ssh "${SSH_OPTS[@]}" "$SSH_USER@$SERVER" bash -s -- "$@" <scripts/release-remote.sh
}

# The portal is the site's home page. Each live game's folder is checked too
# (a warning only: a game can be listed before its first release).
smoke() {
  local args=() slug
  while read -r slug; do args+=(--warn-path "$slug/"); done < <(
    python3 -c 'import json; [print(g["slug"]) for g in json.load(open("games.json")) if g["status"] == "live"]'
  )
  python3 scripts/smoke_test.py "http://$SERVER/" --host "$SITE_HOST" --title "$TITLE" "${args[@]}" "$@"
}

preflight() {
  step "Preflight"
  [[ -z "$(git status --porcelain)" ]] || die "working tree has changes; release only committed code"
  git fetch -q origin main
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] ||
    die "HEAD is not origin/main; check out and pull main first"
  local sha
  sha="$(git rev-parse HEAD)"
  echo "commit $sha"

  # Static checks (CodeQL, gitleaks, audit, tests) and the dynamic ZAP scan of
  # staging all ran in CI on this exact commit; require every one to have passed.
  local runs
  runs="$(gh api "repos/$REPO/commits/$sha/check-runs" \
    --jq '.check_runs[] | "\(.name)\t\(.status)\t\(.conclusion)"')"
  local name
  for name in "${REQUIRED_CHECKS[@]}"; do
    grep -qP "^\Q$name\E\tcompleted\tsuccess$" <<<"$runs" ||
      die "CI check '$name' has not passed on $sha"
    echo "ok   CI: $name"
  done
  if grep -P "\tcompleted\t(failure|cancelled|timed_out|action_required)$" <<<"$runs"; then
    die "a CI check failed on $sha"
  fi
}

build() {
  step "Install, check and build"
  npm ci --silent
  npm audit --audit-level=high
  npm run check
}

cmd_deploy() {
  local dry_run=false
  [[ "${1:-}" == "--dry-run" ]] && dry_run=true
  load_env
  preflight
  build

  local id
  id="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short=8 HEAD)"
  printf '{"id":"%s","commit":"%s"}\n' "$id" "$(git rev-parse HEAD)" >dist/release.json
  echo "release id: $id"

  if $dry_run; then
    step "Dry run: nothing uploaded. Current server state:"
    remote status "$SLUG"
    return
  fi

  step "Upload"
  local plan upload_to live_dir
  plan="$(remote prepare "$SLUG" "$id")"
  upload_to="$(sed -n 's/^upload_to=//p' <<<"$plan")"
  live_dir="$(sed -n 's/^live_dir=//p' <<<"$plan")"
  [[ -n "$upload_to" ]] || die "server did not return an upload folder"
  # --link-dest shares unchanged files with the live release (hard links), so
  # each release only stores what changed.
  rsync -a --delete --chmod=D2755,F644 ${live_dir:+--link-dest="$live_dir"} \
    -e "ssh ${SSH_OPTS[*]}" dist/ "$SSH_USER@$SERVER:$upload_to/"

  step "Switch"
  remote activate "$SLUG" "$id"
  remote portal-links "$SLUG"

  step "Smoke test"
  if ! smoke --release-id "$id"; then
    if [[ -n "$live_dir" ]]; then
      echo "Smoke test failed: rolling back to $(basename "$live_dir")"
      remote rollback "$SLUG"
      remote portal-links "$SLUG"
    else
      echo "Smoke test failed and there is no earlier release to roll back to."
    fi
    die "release $id failed its smoke test"
  fi

  step "Tidy up (keep $KEEP releases)"
  remote prune "$SLUG" "$KEEP"
  echo
  echo "Released $id: http://$SITE_HOST/"
}

cmd_rollback() {
  load_env
  remote rollback "$SLUG"
  remote portal-links "$SLUG"
  smoke
}

cmd_status() {
  load_env
  remote status "$SLUG"
}

case "${1:-}" in
  deploy) shift && cmd_deploy "$@" ;;
  rollback) cmd_rollback ;;
  status) cmd_status ;;
  *)
    sed -n '2,10p' "$0"
    exit 2
    ;;
esac
