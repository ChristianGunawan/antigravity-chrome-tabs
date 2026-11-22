import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin", "cli.mjs");

function runCli(args, envHome) {
  const out = execFileSync(process.execPath, [cliPath, ...args], {
    env: { ...process.env, AGY_HOME_OVERRIDE: envHome },
    encoding: "utf8"
  });
  return JSON.parse(out);
}

const tmpHome = mkdtempSync(path.join(os.tmpdir(), "agy-cli-test-"));
const decoyDir = mkdtempSync(path.join(os.tmpdir(), "agy-decoy-"));
try {
  // 1. Pre-seed existing mcp_config.json and test install --yes --no-open --json
  const mcpDir = path.join(tmpHome, ".gemini", "antigravity");
  const mcpFile = path.join(mcpDir, "mcp_config.json");
  mkdirSync(mcpDir, { recursive: true });
  writeFileSync(mcpFile, JSON.stringify({ mcpServers: { existing: { command: "echo" } } }), "utf8");

  const inst = runCli(["install", "--yes", "--no-open", "--json"], tmpHome);
  assert.equal(inst.ok, true);
  assert.equal(inst.mcpUpdated, true);
  assert.ok(existsSync(path.join(tmpHome, ".antigravity-chrome-tabs", "extension", "manifest.json")));
  assert.ok(existsSync(path.join(tmpHome, ".antigravity-chrome-tabs", "extension", "icons", "icon128.png")));
  assert.ok(existsSync(path.join(tmpHome, ".agents", "skills", "antigravity-chrome-tabs", "SKILL.md")));
  assert.ok(existsSync(`${mcpFile}.bak`));

  const cfg = JSON.parse(readFileSync(mcpFile, "utf8"));
  assert.ok(cfg.mcpServers.existing);
  assert.deepEqual(cfg.mcpServers["chrome-devtools"].args, [
    "-y",
    "chrome-devtools-mcp@1.13.0",
    "--autoConnect",
    "--categoryExtensions"
  ]);

  if (process.platform !== "win32") {
    assert.equal(statSync(mcpFile).mode & 0o777, 0o600);
    assert.equal(statSync(`${mcpFile}.bak`).mode & 0o777, 0o600);
  }

  // 2. status --json, doctor --json, verify --json
  const st = runCli(["status", "--json"], tmpHome);
  assert.equal(st.installed.extension, true);
  assert.equal(st.installed.skill, true);
  assert.equal(st.installed.mcpConfigured, true);

  const doc = runCli(["doctor", "--json"], tmpHome);
  assert.equal(doc.ok, true);
  assert.equal(doc.checks.node.ok, true);
  assert.equal(doc.checks.extension.ok, true);
  assert.equal(doc.checks.mcpConfig.ok, true);

  const ver = runCli(["verify", "--json"], tmpHome);
  assert.equal(ver.ok, true);

  // 3. Symlink escape guard must fail closed without touching external decoy file
  const decoyFile = path.join(decoyDir, "secret.json");
  writeFileSync(decoyFile, '{"untouched":true}', "utf8");
  rmSync(mcpFile);
  symlinkSync(decoyFile, mcpFile);

  let failedClosed = false;
  try {
    runCli(["install", "--yes", "--no-open", "--json"], tmpHome);
  } catch {
    failedClosed = true;
  }
  assert.equal(failedClosed, true, "Expected install to reject symlink mcp_config.json");
  assert.equal(readFileSync(decoyFile, "utf8"), '{"untouched":true}');

  // 4. Symlink AGY_HOME_OVERRIDE root directory must also fail closed
  const symRootParent = mkdtempSync(path.join(os.tmpdir(), "agy-symroot-"));
  const symHome = path.join(symRootParent, "linked-home");
  symlinkSync(decoyDir, symHome);
  let symRootBlocked = false;
  try {
    runCli(["install", "--yes", "--no-open", "--json"], symHome);
  } catch {
    symRootBlocked = true;
  } finally {
    rmSync(symRootParent, { recursive: true, force: true });
  }
  assert.equal(symRootBlocked, true, "Expected install to reject symlink root directory");
  assert.equal(existsSync(path.join(decoyDir, ".antigravity-chrome-tabs")), false);

  // 5. uninstall --yes --json cleans extension/skill & chrome-devtools while keeping existing MCP servers
  const uninstHome = mkdtempSync(path.join(os.tmpdir(), "agy-uninst-test-"));
  try {
    const umcpDir = path.join(uninstHome, ".gemini", "antigravity");
    const umcpFile = path.join(umcpDir, "mcp_config.json");
    mkdirSync(umcpDir, { recursive: true });
    writeFileSync(umcpFile, JSON.stringify({ mcpServers: { existing: { command: "echo" } } }), "utf8");
    runCli(["install", "--yes", "--no-open", "--json"], uninstHome);

    const un = runCli(["uninstall", "--yes", "--json"], uninstHome);
    assert.equal(un.ok, true);
    assert.equal(un.removed.extension, true);
    assert.equal(un.removed.skill, true);
    assert.equal(un.removed.mcpEntry, true);
    assert.equal(existsSync(path.join(uninstHome, ".antigravity-chrome-tabs")), false);
    assert.equal(existsSync(path.join(uninstHome, ".agents", "skills", "antigravity-chrome-tabs")), false);

    const ucfg = JSON.parse(readFileSync(umcpFile, "utf8"));
    assert.equal(ucfg.mcpServers["chrome-devtools"], undefined);
    assert.ok(ucfg.mcpServers.existing);
    if (process.platform !== "win32") {
      assert.equal(statSync(umcpFile).mode & 0o777, 0o600);
    }
  } finally {
    rmSync(uninstHome, { recursive: true, force: true });
  }

  console.log("PASS: CLI agent-native commands & security guards verified (5/5 suites)");
} finally {
  rmSync(tmpHome, { recursive: true, force: true });
  rmSync(decoyDir, { recursive: true, force: true });
}
