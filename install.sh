#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js (>= 20.19 or 22 LTS) is required. Install it from https://nodejs.org or via nvm." >&2
  exit 1
fi

node "$REPO_DIR/bin/cli.mjs" verify
exec node "$REPO_DIR/bin/cli.mjs" install "$@"
