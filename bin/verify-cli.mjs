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
  assert.ok(existsSync(path.join(tmpHome, ".agents", "skills", "antigravity-chrome-tabs", "SKILL.md")));
  assert.ok(existsSync(`${mcpFile}.bak`));

  const cfg = JSON.parse(readFileSync(mcpFile, "utf8"));
  assert.ok(cfg.mcpServers.existing);
  assert.deepEqual(cfg.mcpServers["chrome-devtools"].args, [
    "-y",
    "chrome-devtools-mcp@latest",
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

  console.log("PASS: CLI agent-native commands & security guards verified (3/3 suites)");
} finally {
  rmSync(tmpHome, { recursive: true, force: true });
  rmSync(decoyDir, { recursive: true, force: true });
}
