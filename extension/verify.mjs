import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const dir = new URL(".", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.permissions.length, 2);
assert.ok(manifest.permissions.includes("tabs"));
assert.ok(manifest.permissions.includes("tabGroups"));
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.background.service_worker, "background.js");

let nextTabId = 100;
let nextGroupId = 500;
const tabs = [{ id: 1, windowId: 10, url: "https://example.com", active: true, groupId: 400 }];
const groups = [{ id: 400, windowId: 10, title: "PERSONAL", color: "blue", collapsed: false }];

const mockChrome = {
  tabs: {
    async query(q = {}) {
      return tabs.filter(t => q.groupId === undefined || t.groupId === q.groupId);
    },
    async create({ url, active = true, windowId = 10 }) {
      const tab = { id: ++nextTabId, windowId, url, active, groupId: -1 };
      tabs.push(tab);
      return tab;
    },
    async group({ groupId, tabIds }) {
      let gid = groupId;
      if (gid === undefined) {
        const firstTab = tabs.find(t => t.id === tabIds[0]);
        gid = ++nextGroupId;
        groups.push({ id: gid, windowId: firstTab.windowId, title: "", color: "grey", collapsed: false });
      }
      for (const id of tabIds) {
        const t = tabs.find(x => x.id === id);
        if (t) t.groupId = gid;
      }
      return gid;
    },
    async remove(ids) {
      const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
      for (let i = tabs.length - 1; i >= 0; i--) {
        if (idSet.has(tabs[i].id)) tabs.splice(i, 1);
      }
      for (let i = groups.length - 1; i >= 0; i--) {
        if (!tabs.some(t => t.groupId === groups[i].id)) groups.splice(i, 1);
      }
    }
  },
  tabGroups: {
    async query(q = {}) {
      return groups.filter(g => q.title === undefined || g.title === q.title);
    },
    async update(id, props) {
      const g = groups.find(x => x.id === id);
      if (g) Object.assign(g, props);
      return g;
    }
  }
};

const ctx = { chrome: mockChrome, URL, globalThis: {} };
ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL("background.js", dir), "utf8"), ctx);

const { openInGroup, groupTab, closeGroup, closeAllAgentGroups, listGroups } = ctx.agyTabs;

// 1. Background tab creation & group isolation
const r1 = await openInGroup("https://flow.google.com/project/demo", "AGY-FLOW", "purple");
assert.equal(r1.groupName, "AGY-FLOW");
assert.equal(r1.color, "purple");
assert.equal(tabs.find(t => t.id === r1.tabId).active, false);
assert.equal(tabs.find(t => t.id === 1).active, true);

// 2. Reuse groupId within same group
const r2 = await openInGroup("https://example.org", "AGY-FLOW", "purple");
assert.equal(r2.groupId, r1.groupId);

// 3. groupTab works for existing background http/https tabs without activating
tabs.push({ id: 205, windowId: 10, url: "https://github.com/org/repo", active: false, groupId: -1 });
const gTab = await groupTab("github.com/org", "AGY-GH", "invalid-color");
assert.equal(gTab.color, "purple");

// 4. Security guards: reject dangerous URL schemes and non-AGY group names
for (const badUrl of ["chrome://settings", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi"]) {
  await assert.rejects(() => openInGroup(badUrl, "AGY-TEST"), /Blocked URL scheme|Invalid URL/);
}
await assert.rejects(() => openInGroup("https://example.com", "PERSONAL"), /Refusing non-agent group/);
await assert.rejects(() => closeGroup("PERSONAL"), /Refusing non-agent group/);

// 5. listGroups & closeGroup & closeAllAgentGroups preserve PERSONAL user group
assert.equal((await listGroups(true)).length, 2);
const closedFlow = await closeGroup("AGY-FLOW");
assert.equal(closedFlow.closedTabs, 2);
assert.equal(closedFlow.closedGroups, 1);

const closedAll = await closeAllAgentGroups();
assert.equal(closedAll.closedTabs, 1);
assert.equal(closedAll.closedGroups, 1);
assert.equal(groups.length, 1);
assert.equal(groups[0].title, "PERSONAL");
assert.equal(tabs.length, 1);

console.log("PASS: extension security & lifecycle verified (5/5 checks)");
