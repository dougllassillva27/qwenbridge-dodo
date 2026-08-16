#!/usr/bin/env bash
set -euo pipefail

ensure_writable_dir() {
  local dir="$1"

  mkdir -p "$dir"

  if [ "$(id -u)" = "0" ]; then
    chown -R pwuser:pwuser "$dir" 2>/dev/null || true
  fi

  if ! gosu pwuser test -w "$dir"; then
    echo "Error: $dir is not writable by pwuser. Check Docker volume permissions." >&2
    exit 1
  fi
}

ensure_writable_dir /app/data
ensure_writable_dir /app/data/db
ensure_writable_dir /app/data/qwen_profiles
ensure_writable_dir /tmp/playwright

# Clean stale Chromium locks across all persistent profiles
find /app/data/qwen_profiles -name "Singleton*" -delete 2>/dev/null || true

# Start Xvfb virtual display server
# This provides a real 1920x1080 visual rendering surface so Chromium runs in headed mode,
# completely bypassing Alibaba headless anti-bot detection while remaining invisible.
export DISPLAY=:99
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nolisten unix >/dev/null 2>&1 &
XVFB_PID=$!

cleanup() {
  kill -9 "$XVFB_PID" 2>/dev/null || true
}
trap cleanup EXIT

exec gosu pwuser "$@"
