# Security Policy

## Scope & Least-Privilege Architecture

`antigravity-chrome-tabs` is designed for local agent workflows inside the user's Chrome browser:

1. **Extension Permissions**: `manifest.json` requests only `tabs` and `tabGroups`. It requests zero `host_permissions`, zero `<all_urls>`, zero `cookies`, zero `history`, and zero network/telemetry APIs.
2. **URL Scheme Allowlist**: `openInGroup` strictly validates URLs with `new URL()` and permits `http:` and `https:` schemes only (`chrome://`, `file://`, `javascript:`, `data:` are rejected).
3. **Group Name Isolation**: Agent operations only create, modify, or close tab groups matching `/^(?:antigravity|agy)(?:[-_a-z0-9]{0,24})?$/i`, and `groupTab` excludes active tabs and tabs already in another group — preventing accidental modification or closure of personal tab groups.
4. **Remote Debugging Consent & Trust Boundary**: `chrome-devtools-mcp --autoConnect` connects an approved local MCP client to your active Chrome profile over CDP after you click **Allow** on Chrome's `chrome://inspect/#remote-debugging` prompt. For strict profile isolation, omit `--autoConnect` to run an isolated Chrome profile.

## Reporting a Vulnerability

Please report security issues privately via GitHub Security Advisories at:
https://github.com/ChristianGunawan/antigravity-chrome-tabs/security
