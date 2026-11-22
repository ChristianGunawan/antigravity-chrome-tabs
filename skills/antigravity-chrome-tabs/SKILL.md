---
name: antigravity-chrome-tabs
description: Replicates Codex for Chrome's colored background tab-group isolation using chrome-devtools-mcp (--autoConnect --categoryExtensions) and the privacy-first Antigravity Tab Groups MV3 Chrome extension.
---

# Antigravity Chrome Tab Groups (`antigravity-chrome-tabs`)

Opens, automates, and cleans up background Chrome tabs inside labeled colored **`AGY-*`** tab groups so agents never switch or interrupt the user's active tab.

## Security & Privacy Guarantees

- Extension requests **only** `tabs` and `tabGroups` permissions (no `<all_urls>`, no `cookies`, no `history`, no remote network requests).
- Enforces an **`http:` / `https:` URL scheme allowlist** (blocks `chrome://`, `file://`, `javascript:`, `data:`).
- Enforces an **`AGY*` group prefix guard** so agents cannot touch personal tab groups.

## Agent Self-Check CLI (`CLI-Anything` JSON Interface)

Check installation and Chrome remote debugging readiness in 1 call:
```bash
npx github:ChristianGunawan/antigravity-chrome-tabs status --json
npx github:ChristianGunawan/antigravity-chrome-tabs doctor --json
npx github:ChristianGunawan/antigravity-chrome-tabs verify --json
```

## Lifecycle Workflow (via `chrome-devtools` MCP)

1. **Discover or wake the extension service worker**:
   - Call `list_pages` and look under `## Extension Service Workers` for **Antigravity Tab Groups** (`background.js`).
   - If MV3 went idle, call `list_extensions` -> `reload_extension(id)` -> `list_pages` to wake its `sw-*` `serviceWorkerId`.
2. **Open tab in a colored background group** (never activates tab):
   - Call `evaluate_script` with `serviceWorkerId`:
     ```js
     () => agyTabs.openInGroup("https://example.com", "AGY-TASK", "purple")
     ```
3. **Automate asynchronously by `pageId`**:
   - Call `list_pages` to get the background tab's `pageId`, then run `take_snapshot`, `fill`, `click`, `take_screenshot`, and `evaluate_script` strictly with that `pageId`. NEVER call `select_page`.
4. **Close the group when done**:
   - Call `evaluate_script` with `serviceWorkerId`:
     ```js
     () => agyTabs.closeGroup("AGY-TASK")
     ```
   - Or panic-close all agent groups: `agyTabs.closeAllAgentGroups()`.
