#!/usr/bin/env python3
"""Repo hygiene checks run in CI.

- Art packs (legacy/) and OS junk files are never committed.
- No committed file is larger than 5 MB.
- Every file in public/images/ is a real PNG, WebP or JPEG.
- No private network addresses (server or dev machine) in tracked text files;
  they belong in the git-ignored deploy/server.env.
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAX_BYTES = 5 * 1024 * 1024
FORBIDDEN = re.compile(r"(^|/)(legacy/|__MACOSX/|\.DS_Store$)")
PRIVATE_IP = re.compile(
    r"\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b"
)
TEXT_SUFFIXES = {".md", ".ts", ".js", ".json", ".yml", ".yaml", ".py", ".sh", ".html", ".css", ".txt", ".example", ".conf", ""}
SIGNATURES = {
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".jpg": [b"\xff\xd8\xff"],
    ".webp": [b"RIFF"],
}


def main() -> int:
    errors = []
    tracked = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, check=True, capture_output=True, text=True
    ).stdout.splitlines()

    for path in tracked:
        if FORBIDDEN.search(path):
            errors.append(f"must not be committed: {path}")
        full = ROOT / path
        if full.is_file() and full.stat().st_size > MAX_BYTES:
            errors.append(f"file over 5 MB: {path}")
        if full.is_file() and full.suffix in TEXT_SUFFIXES and path != "package-lock.json":
            match = PRIVATE_IP.search(full.read_text(errors="ignore"))
            if match:
                errors.append(f"private network address {match.group()} in {path}")

    images = ROOT / "public" / "images"
    count = 0
    for f in sorted(images.rglob("*")) if images.exists() else []:
        if not f.is_file():
            continue
        count += 1
        rel = f.relative_to(ROOT)
        sigs = SIGNATURES.get(f.suffix)
        if sigs is None:
            errors.append(f"unexpected image type: {rel}")
        elif not any(f.read_bytes().startswith(s) for s in sigs):
            errors.append(f"not a valid {f.suffix} file: {rel}")

    for e in errors:
        print(f"ERROR: {e}")
    print(f"checked {len(tracked)} tracked files, {count} images: "
          f"{'FAILED' if errors else 'OK'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
