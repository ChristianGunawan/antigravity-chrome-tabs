#!/usr/bin/env node
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SUBCOMMANDS = new Set(["install", "doctor", "status", "verify"]);
const CHROME_DEVTOOLS_MCP_PKG = "chrome-devtools-mcp@1.13.0";
const argv = process.argv.slice(2);
const positionals = argv.filter(a => !a.startsWith("-"));
const flags = new Set(argv.filter(a => a.startsWith("-")));

const command = positionals[0] || "install";
if (flags.has("--help") || flags.has("-h") || !SUBCOMMANDS.has(command)) {
  const exitCode = flags.has("--help") || flags.has("-h") ? 0 : 1;
  console.log(`Usage: npx github:ChristianGunawan/antigravity-chrome-tabs [command] [options]

Commands:
  install       Install extension, skill, and optionally configure MCP (default)
  doctor        Diagnose Node, extension, skill, MCP config, and Chrome debugging
  status        Report installation state and paths
  verify        Run extension security & lifecycle self-checks

Options:
  --json        Emit machine-readable JSON output
  --yes, -y     Update mcp_config.json without interactive confirmation
  --dry-run     Print planned actions without writing files
  --no-open     Do not open Finder/file manager on the extension folder
  --help, -h    Show this help message`);
  process.exit(exitCode);
}

const jsonMode = flags.has("--json");
const dryRun = flags.has("--dry-run");
const autoYes = flags.has("--yes") || flags.has("-y");
const noOpen = flags.has("--no-open");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const targetHome = process.env.AGY_HOME_OVERRIDE || os.homedir();
const extDest = path.join(targetHome, ".antigravity-chrome-tabs", "extension");
const skillDest = path.join(targetHome, ".agents", "skills", "antigravity-chrome-tabs", "SKILL.md");
const mcpPath = path.join(targetHome, ".gemini", "antigravity", "mcp_config.json");
const extFiles = ["manifest.json", "background.js", "popup.html", "popup.js"];

function log(msg) {
  if (!jsonMode) console.log(msg);
}

function outJson(payload, exitCode = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
}

/**
 * Symlink / path-traversal guard relative to resolved targetHome.
 */
function assertSafePath(rootDir, targetPath) {
  if (lstatSync(rootDir).isSymbolicLink()) {
    throw new Error(`Refusing symlink root directory: ${rootDir}`);
  }
  const rel = path.relative(rootDir, targetPath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Unsafe target path outside home root: ${targetPath}`);
  }
  const realRoot = realpathSync(rootDir);
  let cur = rootDir;
  for (const seg of rel.split(path.sep)) {
    cur = path.join(cur, seg);
    if (existsSync(cur)) {
      if (lstatSync(cur).isSymbolicLink()) {
        throw new Error(`Refusing symlink in target path: ${cur}`);
      }
      const realCur = realpathSync(cur);
      if (realCur !== realRoot && !realCur.startsWith(`${realRoot}${path.sep}`)) {
        throw new Error(`Target escapes root directory: ${cur}`);
      }
    }
  }
}

function writeFileAtomic(filePath, content, mode = 0o600) {
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  assertSafePath(targetHome, tmpPath);
  try {
    writeFileSync(tmpPath, content, { encoding: "utf8", mode });
    try { chmodSync(tmpPath, mode); } catch {}
    renameSync(tmpPath, filePath);
  } catch (err) {
    try { unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

function checkNodeVersion() {
  const [maj, min] = process.versions.node.split(".").map(Number);
  return { ok: maj > 20 || (maj === 20 && min >= 19), version: process.versions.node };
}

function readJsonSafe(filePath) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(filePath, "utf8")) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function collectStatus() {
  const extInstalled = extFiles.every(f => existsSync(path.join(extDest, f)));
  const skillInstalled = existsSync(skillDest);
  const mcpExists = existsSync(mcpPath);
  let mcpConfigured = false;
  if (mcpExists) {
    const parsed = readJsonSafe(mcpPath);
    const cd = parsed.data?.mcpServers?.["chrome-devtools"];
    const argsList = Array.isArray(cd?.args) ? cd.args : [];
    mcpConfigured = argsList.includes("--autoConnect") && argsList.includes("--categoryExtensions");
  }
  return {
    version: pkg.version,
    home: targetHome,
    paths: { extension: extDest, skill: skillDest, mcpConfig: mcpPath },
    installed: {
      extension: extInstalled,
      skill: skillInstalled,
      mcpConfigExists: mcpExists,
      mcpConfigured
    }
  };
}

function checkChromeDevToolsPort() {
  if (process.env.AGY_HOME_OVERRIDE) {
    return { ok: true, skipped: true, reason: "Skipped Chrome profile probe under AGY_HOME_OVERRIDE" };
  }
  let portFile;
  if (process.platform === "darwin") {
    portFile = path.join(targetHome, "Library", "Application Support", "Google", "Chrome", "DevToolsActivePort");
  } else if (process.platform === "linux") {
    portFile = path.join(targetHome, ".config", "google-chrome", "DevToolsActivePort");
  } else {
    portFile = path.join(process.env.LOCALAPPDATA || path.join(targetHome, "AppData", "Local"), "Google", "Chrome", "User Data", "DevToolsActivePort");
  }
  try {
    readFileSync(portFile, "utf8");
    return { ok: true, path: portFile };
  } catch (err) {
    return {
      ok: false,
      code: err.code || "UNKNOWN",
      path: portFile,
      hint: err.code === "EPERM" || err.code === "EACCES"
        ? "Grant Full Disk Access to your client app or omit --autoConnect for an isolated profile."
        : "Enable chrome://inspect/#remote-debugging in Chrome."
    };
  }
}

if (command === "status") {
  const st = collectStatus();
  if (jsonMode) outJson(st);
  console.log(`antigravity-chrome-tabs v${st.version}`);
  console.log(`extension : ${st.installed.extension ? "installed" : "missing"} (${st.paths.extension})`);
  console.log(`skill     : ${st.installed.skill ? "installed" : "missing"} (${st.paths.skill})`);
  console.log(`mcpConfig : ${st.installed.mcpConfigured ? "configured" : "not configured"} (${st.paths.mcpConfig})`);
  process.exit(0);
}

if (command === "verify") {
  const verifyScript = path.join(repoRoot, "extension", "verify.mjs");
  try {
    const stdout = execFileSync(process.execPath, [verifyScript], { encoding: "utf8" }).trim();
    if (jsonMode) outJson({ ok: true, output: stdout });
    console.log(stdout);
    process.exit(0);
  } catch (err) {
    const errMsg = err.stderr || err.message;
    if (jsonMode) outJson({ ok: false, error: errMsg }, 1);
    console.error(errMsg);
    process.exit(1);
  }
}

if (command === "doctor") {
  const nodeCheck = checkNodeVersion();
  const st = collectStatus();
  let manifestOk = false;
  let perms = [];
  if (st.installed.extension) {
    const mf = readJsonSafe(path.join(extDest, "manifest.json"));
    perms = mf.data?.permissions || [];
    manifestOk = mf.ok && perms.length === 2 && perms.includes("tabs") && perms.includes("tabGroups") && !mf.data?.host_permissions;
  }
  const chromeCheck = checkChromeDevToolsPort();
  const ok = Boolean(nodeCheck.ok && st.installed.extension && manifestOk && st.installed.skill && st.installed.mcpConfigured);
  const report = {
    ok,
    checks: {
      node: nodeCheck,
      extension: { ok: st.installed.extension && manifestOk, permissions: perms, path: extDest },
      skill: { ok: st.installed.skill, path: skillDest },
      mcpConfig: { ok: st.installed.mcpConfigured, path: mcpPath },
      chromeRemoteDebugging: chromeCheck
    }
  };
  if (jsonMode) outJson(report, ok ? 0 : 1);
  console.log("=== Antigravity Chrome Tabs Doctor ===");
  for (const [k, v] of Object.entries(report.checks)) {
    const badge = v.ok ? "OK" : (k === "chromeRemoteDebugging" ? "WARN" : "FAIL");
    console.log(`[${badge}] ${k}: ${JSON.stringify(v)}`);
  }
  process.exit(ok ? 0 : 1);
}

// command === "install"
const nodeCheck = checkNodeVersion();
if (!nodeCheck.ok) {
  const msg = `Node >= 20.19.0 required (found v${nodeCheck.version}).`;
  if (jsonMode) outJson({ ok: false, error: msg }, 1);
  console.error(`Error: ${msg}`);
  process.exit(1);
}

log("=== Antigravity Chrome Tab Groups Installer ===");
log(`Node: v${nodeCheck.version}`);

try {
  assertSafePath(targetHome, extDest);
  assertSafePath(targetHome, skillDest);
  for (const file of extFiles) {
    assertSafePath(targetHome, path.join(extDest, file));
  }
} catch (err) {
  if (jsonMode) outJson({ ok: false, error: err.message }, 1);
  console.error(`Security error: ${err.message}`);
  process.exit(1);
}

if (!dryRun) {
  mkdirSync(extDest, { recursive: true });
  for (const file of extFiles) {
    copyFileSync(path.join(repoRoot, "extension", file), path.join(extDest, file));
  }
  log(`Installed extension -> ${extDest}`);

  mkdirSync(path.dirname(skillDest), { recursive: true });
  copyFileSync(path.join(repoRoot, "skills", "antigravity-chrome-tabs", "SKILL.md"), skillDest);
  log(`Installed skill     -> ${skillDest}`);
}

let updateMcp = autoYes;
if (!autoYes && !dryRun && !jsonMode && process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`\nUpdate ${mcpPath} with chrome-devtools (--autoConnect --categoryExtensions)? [y/N] `);
  rl.close();
  updateMcp = /^[Yy]$/.test(ans.trim());
}

let mcpUpdated = false;
let backupPath = null;
if (!dryRun && updateMcp) {
  try {
    assertSafePath(targetHome, mcpPath);
    assertSafePath(targetHome, `${mcpPath}.bak`);
    mkdirSync(path.dirname(mcpPath), { recursive: true });
    let cfg = {};
    if (existsSync(mcpPath)) {
      const raw = readFileSync(mcpPath, "utf8");
      backupPath = `${mcpPath}.bak`;
      writeFileAtomic(backupPath, raw, 0o600);
      cfg = JSON.parse(raw);
    }
    const nodeBinDir = path.dirname(process.execPath);
    const npxName = process.platform === "win32" ? "npx.cmd" : "npx";
    const npxPath = existsSync(path.join(nodeBinDir, npxName)) ? path.join(nodeBinDir, npxName) : npxName;
    cfg.mcpServers = cfg.mcpServers || {};
    cfg.mcpServers["chrome-devtools"] = {
      command: npxPath,
      args: ["-y", CHROME_DEVTOOLS_MCP_PKG, "--autoConnect", "--categoryExtensions"],
      env: { PATH: `${nodeBinDir}${path.delimiter}${process.env.PATH || ""}` }
    };
    writeFileAtomic(mcpPath, JSON.stringify(cfg, null, 2) + "\n", 0o600);
    mcpUpdated = true;
    log(`Updated MCP config  -> ${mcpPath}`);
  } catch (err) {
    if (jsonMode) outJson({ ok: false, error: err.message }, 1);
    console.error(`Error updating MCP config: ${err.message}`);
    process.exit(1);
  }
} else if (!dryRun) {
  log("Skipped MCP config update (pass --yes or copy mcp_config.example.json manually).");
}

if (!dryRun && !noOpen && !jsonMode && process.platform === "darwin") {
  try {
    execFileSync("open", [extDest], { stdio: "ignore" });
  } catch {}
}

if (jsonMode) {
  outJson({
    ok: true,
    dryRun,
    extensionPath: extDest,
    skillPath: skillDest,
    mcpConfigPath: mcpPath,
    mcpUpdated,
    backupPath
  });
}

log(`
=== Final 2 Chrome Clicks ===
1. Open chrome://extensions -> enable Developer mode -> click "Load unpacked" -> select:
   ${extDest}
2. Open chrome://inspect/#remote-debugging -> check "Allow remote debugging for this browser instance"
3. Reload Antigravity / your MCP client.`);
