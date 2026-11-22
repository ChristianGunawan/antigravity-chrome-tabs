# Antigravity Chrome Tabs (`antigravity-chrome-tabs`)

Give your AI agent **Codex-style colored background Chrome tab groups** (`AGY-*`) without touching your active tab, cursor, or focus.

Pairs [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) (`--autoConnect --categoryExtensions`) with a **privacy-first MV3 Chrome extension**.

---

## Why Use This?
- **Never steals focus**: Opens & automates tasks in background purple **`AGY-*`** tab groups while you browse or watch videos undisturbed.
- **Auto-cleanup + panic button**: Agent calls `agyTabs.closeGroup("AGY-TASK")` when done, or click the toolbar icon → **Close All Agent Groups** anytime.
- **Strict least-privilege permissions**: Only `tabs` and `tabGroups` — **no** `<all_urls>`, **no** `cookies`, **no** `history`, **no** external network calls.

---

## Quick Setup (3 Clicks & Done)

### 1. Install Skill & Load Extension
```bash
git clone https://github.com/ChristianGunawan/antigravity-chrome-tabs.git
cd antigravity-chrome-tabs
./install.sh
```
Or install just the agent skill via [`skills`](https://skills.sh):
```bash
npx skills add ChristianGunawan/antigravity-chrome-tabs
```

### 2. Enable in Chrome (One-Time)
1. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick `antigravity-chrome-tabs/extension/`.
2. Open `chrome://inspect/#remote-debugging` → check **Allow remote debugging for this browser instance**.
3. Reload your AI client (`mcp_config.example.json` has the exact config). When the agent connects, click **Allow** once on Chrome's remote debugging prompt.

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
node extension/verify.mjs
```

## License

[MIT](LICENSE)
