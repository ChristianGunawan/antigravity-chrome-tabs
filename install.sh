#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$REPO_DIR/extension"
MCP_CONFIG="$HOME/.gemini/antigravity/mcp_config.json"

echo "=== Antigravity Chrome Tab Groups Setup ==="

# 1. Check Node >= 20.19 (chrome-devtools-mcp requirement)
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js (>= 20.19 or 22 LTS) is required. Install it from https://nodejs.org or via nvm."
  exit 1
fi

NODE_VER="$(node -v | sed 's/^v//')"
if ! node -e 'const [maj, min] = process.versions.node.split(".").map(Number); process.exit((maj > 20 || (maj === 20 && min >= 19)) ? 0 : 1)'; then
  echo "Error: Found Node v$NODE_VER, but chrome-devtools-mcp requires Node >= 20.19 (v22 LTS recommended)."
  exit 1
fi

NPX_BIN="$(command -v npx)"
NODE_BIN_DIR="$(dirname "$NPX_BIN")"
echo "OK: Node v$NODE_VER ($NPX_BIN)"

# 2. Verify extension locally before installing
node "$EXT_DIR/verify.mjs"

# 3. Consent-first MCP config update
echo ""
echo "Optional step: add chrome-devtools-mcp (--autoConnect --categoryExtensions) to:"
echo "  $MCP_CONFIG"
REPLY="n"
if [ -t 0 ]; then
  read -r -p "Update mcp_config.json (creates a .bak backup first)? [y/N] " REPLY || true
fi

if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  mkdir -p "$(dirname "$MCP_CONFIG")"
  if [ -f "$MCP_CONFIG" ]; then
    cp "$MCP_CONFIG" "$MCP_CONFIG.bak"
    echo "Backup saved: $MCP_CONFIG.bak"
  fi
  python3 - "$MCP_CONFIG" "$NPX_BIN" "$NODE_BIN_DIR" << 'PY'
import json, os, sys
from pathlib import Path

cfg_path = Path(sys.argv[1])
npx_bin, bin_dir = sys.argv[2], sys.argv[3]
data = json.loads(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else {}
servers = data.setdefault("mcpServers", {})
servers["chrome-devtools"] = {
    "command": npx_bin,
    "args": ["-y", "chrome-devtools-mcp@latest", "--autoConnect", "--categoryExtensions"],
    "env": {"PATH": f"{bin_dir}:{os.environ.get('PATH', '/usr/bin:/bin')}"}
}
cfg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print("Updated:", cfg_path)
PY
else
  echo "Skipped modifying mcp_config.json (see mcp_config.example.json)."
fi

cat << EOF

=== Final 3-Click Chrome Setup ===
1. Open chrome://extensions -> enable "Developer mode" -> click "Load unpacked" -> select:
   $EXT_DIR
2. Open chrome://inspect/#remote-debugging -> check "Allow remote debugging for this browser instance"
3. Reload your MCP client / Antigravity and install the skill if desired:
   npx skills add ChristianGunawan/antigravity-chrome-tabs

Note on macOS: If Chrome remote debugging reports EPERM on DevToolsActivePort, grant Full Disk Access to your client app or use a dedicated profile.
EOF
