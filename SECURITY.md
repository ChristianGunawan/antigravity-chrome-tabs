# Security Policy

## Scope & Least-Privilege Architecture

`antigravity-chrome-tabs` is designed for local agent workflows inside the user's Chrome browser:

1. **Extension Permissions**: `manifest.json` requests only `tabs` and `tabGroups`. It requests zero `host_permissions`, zero `<all_urls>`, zero `cookies`, zero `history`, and zero network/telemetry APIs.
2. **URL Scheme Allowlist**: `openInGroup` strictly validates URLs with `new URL()` and permits `http:` and `https:` schemes only (`chrome://`, `file://`, `javascript:`, `data:` are rejected).
3. **Group Name Isolation**: Agent operations only create, modify, or close tab groups matching `/^agy(?:[-_a-z0-9]{0,29})?$/i`, preventing accidental modification or closure of the user's personal tab groups.
4. **Remote Debugging Consent**: `chrome-devtools-mcp --autoConnect` relies on Chrome's built-in `chrome://inspect/#remote-debugging` confirmation dialog (`Allow` required by the user).

## Reporting a Vulnerability

Please report security issues privately via GitHub Security Advisories at:
https://github.com/ChristianGunawan/antigravity-chrome-tabs/security
