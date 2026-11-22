# Antigravity Chrome Tabs (`antigravity-chrome-tabs`)

Give your AI agent **Codex-style colored background Chrome tab groups** (`AGY-*`) without touching your active tab, cursor, or focus.

Pairs [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) (`--autoConnect --categoryExtensions`) with a **privacy-first MV3 Chrome extension**.

---

## Why Use This?
- **Never steals focus**: Opens & automates tasks in background purple **`AGY-*`** tab groups while you browse or watch videos undisturbed.
- **Auto-cleanup + panic button**: Agent calls `agyTabs.closeGroup("AGY-TASK")` when done, or click the toolbar icon → **Close All Agent Groups** anytime.
- **Strict least-privilege permissions**: Only `tabs` and `tabGroups` — **no** `<all_urls>`, **no** `cookies`, **no** `history`, **no** external network calls.

---

## Quick Setup (1 Command + 2 Chrome Clicks)

### 1. Run the 1-Command Installer (No `git clone` needed)
```bash
npx github:ChristianGunawan/antigravity-chrome-tabs
```
This checks Node `20.19+`, copies the extension to `~/.antigravity-chrome-tabs/extension`, installs the `/find-skills` skill, optionally updates `mcp_config.json` (with `.bak` backup after `y/N` prompt), and opens the extension folder.

Or install only the skill via [`skills`](https://skills.sh):
```bash
npx skills add ChristianGunawan/antigravity-chrome-tabs
```

### 2. Enable in Chrome (One-Time)
1. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick `~/.antigravity-chrome-tabs/extension`.
2. Open `chrome://inspect/#remote-debugging` → check **Allow remote debugging for this browser instance**.
3. Reload your AI client (`mcp_config.example.json` has the exact config). When the agent connects, click **Allow** once on Chrome's remote debugging prompt.

*(Roadmap: Publishing to the Chrome Web Store will remove Developer Mode / Load Unpacked for a pure 1-click install.)*

*(macOS tip: If `chrome-devtools-mcp --autoConnect` hits `EPERM` reading `DevToolsActivePort`, grant Full Disk Access to your AI client in System Settings, or run `chrome-devtools-mcp` without `--autoConnect` for an isolated profile.)*

---

## Security & Privacy Design

| Protection | How It Works |
| :--- | :--- |
| **Minimal permissions** | `manifest.json` declares `["tabs", "tabGroups"]` only — zero `host_permissions` or `<all_urls>`. |
| **Scheme allowlist** | `openInGroup` only allows `http:` and `https:`; blocks `chrome://`, `file://`, `javascript:`, `data:`. |
| **User-group isolation** | `openInGroup`, `groupTab`, and `closeGroup` refuse any group name not starting with `AGY`. |
| **Zero telemetry** | Zero network fetches, zero analytics, zero persistent history storage. |

## Verification

```bash
npm test
npx github:ChristianGunawan/antigravity-chrome-tabs status --json
npx github:ChristianGunawan/antigravity-chrome-tabs doctor --json
```

## License

[MIT](LICENSE)
