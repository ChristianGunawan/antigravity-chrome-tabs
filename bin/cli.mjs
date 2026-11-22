#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: npx github:ChristianGunawan/antigravity-chrome-tabs [options]

Installs the Antigravity Tab Groups Chrome extension & /find-skills skill locally.

Options:
  --yes, -y     Update mcp_config.json without interactive confirmation
  --dry-run     Print planned actions without writing files
  --no-open     Do not open Finder/file manager on the extension folder
  --help, -h    Show this help message`);
  process.exit(0);
}

const dryRun = args.has("--dry-run");
const autoYes = args.has("--yes") || args.has("-y");
const noOpen = args.has("--no-open");

const [maj, min] = process.versions.node.split(".").map(Number);
if (!(maj > 20 || (maj === 20 && min >= 19))) {
  console.error(`Error: Node >= 20.19.0 required (found v${process.versions.node}).`);
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetHome = process.env.AGY_HOME_OVERRIDE || os.homedir();
const extDest = path.join(targetHome, ".antigravity-chrome-tabs", "extension");
const skillDest = path.join(targetHome, ".agents", "skills", "antigravity-chrome-tabs", "SKILL.md");
const mcpPath = path.join(targetHome, ".gemini", "antigravity", "mcp_config.json");

console.log("=== Antigravity Chrome Tab Groups Installer ===");
console.log(`Node: v${process.versions.node}`);

const extFiles = ["manifest.json", "background.js", "popup.html", "popup.js"];
if (dryRun) {
  console.log(`[dry-run] Would copy extension (${extFiles.join(", ")}) -> ${extDest}`);
  console.log(`[dry-run] Would install skill -> ${skillDest}`);
} else {
  mkdirSync(extDest, { recursive: true });
  for (const file of extFiles) {
    copyFileSync(path.join(repoRoot, "extension", file), path.join(extDest, file));
  }
  console.log(`Installed extension -> ${extDest}`);

  mkdirSync(path.dirname(skillDest), { recursive: true });
  copyFileSync(path.join(repoRoot, "skills", "antigravity-chrome-tabs", "SKILL.md"), skillDest);
  console.log(`Installed skill     -> ${skillDest}`);
}

let updateMcp = autoYes;
if (!autoYes && !dryRun && process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`\nUpdate ${mcpPath} with chrome-devtools (--autoConnect --categoryExtensions)? [y/N] `);
  rl.close();
  updateMcp = /^[Yy]$/.test(ans.trim());
}

if (dryRun) {
  console.log(`[dry-run] Would update ${mcpPath} (with .bak backup)`);
} else if (updateMcp) {
  mkdirSync(path.dirname(mcpPath), { recursive: true });
  let cfg = {};
  if (existsSync(mcpPath)) {
    const raw = readFileSync(mcpPath, "utf8");
    writeFileSync(`${mcpPath}.bak`, raw, "utf8");
    cfg = JSON.parse(raw);
  }
  const nodeBinDir = path.dirname(process.execPath);
  const npxName = process.platform === "win32" ? "npx.cmd" : "npx";
  const npxPath = existsSync(path.join(nodeBinDir, npxName)) ? path.join(nodeBinDir, npxName) : npxName;
  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers["chrome-devtools"] = {
    command: npxPath,
    args: ["-y", "chrome-devtools-mcp@latest", "--autoConnect", "--categoryExtensions"],
    env: { PATH: `${nodeBinDir}${path.delimiter}${process.env.PATH || ""}` }
  };
  writeFileSync(mcpPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  console.log(`Updated MCP config  -> ${mcpPath}`);
} else {
  console.log(`Skipped MCP config update (pass --yes or copy mcp_config.example.json manually).`);
}

if (!dryRun && !noOpen && process.platform === "darwin") {
  try {
    execFileSync("open", [extDest], { stdio: "ignore" });
  } catch {
    // non-fatal on headless sessions
  }
}

console.log(`
=== Final 2 Chrome Clicks ===
1. Open chrome://extensions -> enable Developer mode -> click "Load unpacked" -> select:
   ${extDest}
2. Open chrome://inspect/#remote-debugging -> check "Allow remote debugging for this browser instance"
3. Reload Antigravity / your MCP client.`);
