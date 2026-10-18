#!/usr/bin/env bash
# Tests for scripts/release-remote.sh, run against a temporary folder that
# stands in for the server (RELEASE_TEST_ROOT). Run: bash tests/release/test_release_remote.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")/../.." && pwd)/scripts/release-remote.sh"
PASS=0
FAIL=0
T=""

setup() {
  T="$(mktemp -d /tmp/release-test.XXXXXX)"
  mkdir -p "$T/web" "$T/releases"
}
teardown() { rm -rf "$T"; }

run() { RELEASE_TEST_ROOT="$T" bash "$SCRIPT" "$@"; }

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; }
expect_ok() { # name, command...
  local name="$1"; shift
  if out="$("$@" 2>&1)"; then ok "$name"; else bad "$name: $out"; fi
}
expect_fail() { # name, pattern, command...
  local name="$1" pattern="$2"; shift 2
  if out="$("$@" 2>&1)"; then bad "$name: expected failure, got: $out"
  elif grep -q -- "$pattern" <<<"$out"; then ok "$name"
  else bad "$name: wrong error: $out"; fi
}

# A release with an index.html, the way release.sh uploads one.
make_release() { # id
  run prepare star-destroyer "$1" >/dev/null && echo "<title>$1</title>" >"$T/releases/star-destroyer/$1/index.html"
}
live() { basename "$(readlink "$T/web/star-destroyer")"; }

A=20261017T100000Z-aaaaaaa1
B=20261017T110000Z-bbbbbbb2
C=20261017T120000Z-ccccccc3
D=20261017T130000Z-ddddddd4

# --- input checks -----------------------------------------------------------
setup
expect_fail "rejects a slug with ../" "invalid slug" run status "../etc"
expect_fail "rejects an uppercase slug" "invalid slug" run status "Star"
expect_fail "rejects an empty slug" "invalid slug" run status ""
expect_fail "rejects a bad release id" "invalid release id" run prepare star-destroyer "latest"
expect_fail "rejects an id with a path" "invalid release id" run prepare star-destroyer "../$A"
expect_fail "rejects an unknown op" "unknown op" run explode star-destroyer
expect_fail "test root must be under /tmp" "under /tmp" env RELEASE_TEST_ROOT=/var/tmp bash "$SCRIPT" status star-destroyer
expect_ok "accepts the portal slug" run status _portal
teardown

# --- first release ----------------------------------------------------------
setup
expect_ok "status with no releases" run status star-destroyer
out="$(run prepare star-destroyer "$A")"
if [[ "$out" == *"upload_to=$T/releases/star-destroyer/$A"* && "$out" == *"live_dir="* ]]; then ok "prepare returns the upload folder and no live folder"; else bad "prepare output: $out"; fi
expect_fail "prepare refuses an existing id" "already exists" run prepare star-destroyer "$A"
expect_fail "activate refuses a release without index.html" "no index.html" run activate star-destroyer "$A"
echo "<title>A</title>" >"$T/releases/star-destroyer/$A/index.html"
expect_ok "activate the first release" run activate star-destroyer "$A"
if [[ "$(live)" == "$A" && -f "$T/web/star-destroyer/index.html" ]]; then ok "the live link serves release A"; else bad "live is $(live)"; fi
expect_fail "activate refuses an unknown id" "no such release" run activate star-destroyer "$B"
expect_fail "rollback with only one release" "no release older" run rollback star-destroyer
teardown

# --- switching and rollback ---------------------------------------------------
setup
make_release "$A" && run activate star-destroyer "$A" >/dev/null
out="$(run prepare star-destroyer "$B")"
if [[ "$out" == *"live_dir=$T/releases/star-destroyer/$A"* ]]; then ok "prepare reports the live folder for --link-dest"; else bad "$out"; fi
echo "<title>B</title>" >"$T/releases/star-destroyer/$B/index.html"
run activate star-destroyer "$B" >/dev/null
if [[ "$(live)" == "$B" ]]; then ok "switch to release B"; else bad "live is $(live)"; fi
expect_ok "rollback" run rollback star-destroyer
if [[ "$(live)" == "$A" ]]; then ok "rollback returns to release A"; else bad "live is $(live)"; fi
# Capture first: with pipefail, `| grep -q` can fail when grep exits before status finishes
# writing (status then gets SIGPIPE), even though the line matched.
status_out="$(run status star-destroyer)"
if grep -q "^\* $A (live)" <<<"$status_out"; then ok "status marks the live release"; else bad "status: $status_out"; fi
if compgen -G "$T/web/.*switch*" >/dev/null; then bad "leftover temporary link"; else ok "no temporary links left behind"; fi
teardown

# --- refusals that protect the server ---------------------------------------------
setup
make_release "$A"
mkdir -p "$T/web/star-destroyer" && echo keep >"$T/web/star-destroyer/precious.txt"
expect_fail "refuses to replace a real folder" "not a symlink" run activate star-destroyer "$A"
if [[ -f "$T/web/star-destroyer/precious.txt" ]]; then ok "the real folder is untouched"; else bad "real folder was changed"; fi
rm -rf "$T/web/star-destroyer" && ln -s /etc "$T/web/star-destroyer"
expect_fail "refuses a link pointing outside the releases folder" "points outside" run activate star-destroyer "$A"
teardown

# --- pruning ------------------------------------------------------------------
setup
for id in "$A" "$B" "$C" "$D"; do make_release "$id"; done
run activate star-destroyer "$A" >/dev/null # the oldest is live
expect_ok "prune keeps 2" run prune star-destroyer 2
left="$(find "$T/releases/star-destroyer" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort | tr '\n' ' ')"
if [[ "$left" == "$A $C $D " ]]; then ok "prune kept the 2 newest plus the live one"; else bad "left: $left"; fi
expect_fail "prune needs a positive number" "positive number" run prune star-destroyer 0
teardown

# --- atomic switch: the live link never disappears --------------------------------
setup
make_release "$A" && make_release "$B"
run activate star-destroyer "$A" >/dev/null
missing="$T/missing"
( for _ in $(seq 1 4000); do [[ -f "$T/web/star-destroyer/index.html" ]] || echo x >>"$missing"; done ) &
reader=$!
for i in $(seq 1 100); do run activate star-destroyer "$([[ $((i % 2)) == 0 ]] && echo "$A" || echo "$B")" >/dev/null; done
wait "$reader"
if [[ ! -s "$missing" ]]; then ok "index.html stayed reachable through 100 switches"; else bad "missing $(wc -l <"$missing") times"; fi
teardown

# --- portal: one _portal link, plus a link per top-level file ---------------------
setup
portal_release() { # id, files...
  local id="$1"; shift
  run prepare _portal "$id" >/dev/null
  for f in "$@"; do mkdir -p "$(dirname "$T/releases/_portal/$id/$f")"; echo "$id" >"$T/releases/_portal/$id/$f"; done
}
ln -s "$T/releases/star-destroyer/x" "$T/web/star-destroyer" # a game's link, which must be left alone
portal_release "$A" index.html favicon.png assets/index-AbCd1234.js
run activate _portal "$A" >/dev/null
expect_ok "portal-links on the first release" run portal-links _portal
if [[ "$(readlink "$T/web/index.html")" == _portal/index.html && "$(cat "$T/web/index.html")" == "$A" &&
  -f "$T/web/assets/index-AbCd1234.js" ]]; then ok "index.html, favicon and assets are served through _portal"; else bad "portal links: $(ls -la "$T/web")"; fi
portal_release "$B" index.html assets/index-EfGh5678.js images/star-destroyer.png
run activate _portal "$B" >/dev/null && run portal-links _portal >/dev/null
if [[ "$(cat "$T/web/index.html")" == "$B" && -f "$T/web/images/star-destroyer.png" ]]; then ok "switching _portal switches every file at once"; else bad "after switch: $(ls -la "$T/web")"; fi
if [[ ! -e "$T/web/favicon.png" && ! -L "$T/web/favicon.png" ]]; then ok "a link to a file the new release dropped is removed"; else bad "stale favicon link left"; fi
if [[ "$(readlink "$T/web/star-destroyer")" == "$T/releases/star-destroyer/x" ]]; then ok "the game's link is untouched"; else bad "game link changed"; fi
expect_fail "portal-links only works for _portal" "only for _portal" run portal-links star-destroyer
teardown

setup
portal_release "$A" index.html star-destroyer
ln -s "$T/releases/star-destroyer/x" "$T/web/star-destroyer"
run activate _portal "$A" >/dev/null
expect_fail "refuses a portal file named like a game" "not the portal" run portal-links _portal
if [[ "$(readlink "$T/web/star-destroyer")" == "$T/releases/star-destroyer/x" ]]; then ok "the game's link survives the clash"; else bad "game link replaced"; fi
mkdir "$T/web/notes" && portal_release "$B" index.html notes && run activate _portal "$B" >/dev/null
expect_fail "refuses to replace a real folder in the web root" "not a portal link" run portal-links _portal
teardown

echo
echo "$PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
