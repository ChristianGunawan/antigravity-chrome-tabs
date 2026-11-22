/**
 * Antigravity Tab Groups — MV3 background service worker.
 * Security boundaries:
 * - Zero host permissions, zero external network requests, zero storage/history access.
 * - URL scheme allowlist: http:// and https:// only.
 * - Group name guard: agent actions only touch groups starting with "Antigravity" or "AGY".
 */
(() => {
  const VALID_COLORS = new Set([
    "grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"
  ]);
  const SAFE_GROUP_RE = /^(?:antigravity|agy)(?:[-_a-z0-9]{0,24})?$/i;

  function resolveColor(color) {
    const c = String(color || "purple").toLowerCase();
    return VALID_COLORS.has(c) ? c : "purple";
  }

  function assertAllowedGroup(groupName) {
    const name = String(groupName || "").trim();
    if (!SAFE_GROUP_RE.test(name)) {
      throw new Error(`Refusing non-agent group name "${groupName}": must start with "Antigravity" or "AGY"`);
    }
    return name;
  }

  function assertAllowedUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      throw new Error("URL must be a non-empty string");
    }
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`Invalid URL: ${rawUrl}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Blocked URL scheme "${parsed.protocol}": only http/https allowed`);
    }
    return parsed.href;
  }

  async function assignToGroup(tabIds, windowId, groupName, color) {
    const resolvedColor = resolveColor(color);
    const groups = await chrome.tabGroups.query({ title: groupName });
    const existing = groups.find(g => g.windowId === windowId);
    if (existing) {
      const groupId = await chrome.tabs.group({ groupId: existing.id, tabIds });
      return { groupId, color: existing.color || resolvedColor };
    }
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: groupName,
      color: resolvedColor,
      collapsed: false
    });
    return { groupId, color: resolvedColor };
  }

  async function openInGroup(url, groupName = "Antigravity", color = "purple") {
    const safeUrl = assertAllowedUrl(url);
    const safeGroup = assertAllowedGroup(groupName);
    const tabs = await chrome.tabs.query({});
    const createOpts = { url: safeUrl, active: false };
    if (tabs.length > 0 && tabs[0].windowId != null) {
      createOpts.windowId = tabs[0].windowId;
    }
    const tab = await chrome.tabs.create(createOpts);
    const { groupId, color: resolvedColor } = await assignToGroup(
      [tab.id],
      tab.windowId,
      safeGroup,
      color
    );
    return {
      tabId: tab.id,
      groupId,
      windowId: tab.windowId,
      groupName: safeGroup,
      color: resolvedColor,
      url: safeUrl
    };
  }

  async function groupTab(urlContains, groupName = "Antigravity", color = "purple") {
    const needle = typeof urlContains === "string" ? urlContains.trim() : "";
    if (needle.length < 4) {
      throw new Error("groupTab requires a URL host/path substring of at least 4 characters");
    }
    const safeGroup = assertAllowedGroup(groupName);
    const tabs = await chrome.tabs.query({});
    const matches = tabs.filter(t => {
      if (t.active || (t.groupId !== undefined && t.groupId !== -1)) return false;
      const u = t.url || t.pendingUrl || "";
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
        return (parsed.host + parsed.pathname + parsed.search).includes(needle);
      } catch {
        return false;
      }
    });
    if (matches.length === 0) {
      throw new Error(`No ungrouped background http/https tab matching: ${needle}`);
    }
    const windowId = matches[0].windowId;
    const sameWinIds = matches.filter(t => t.windowId === windowId).map(t => t.id);
    const { groupId, color: resolvedColor } = await assignToGroup(
      sameWinIds,
      windowId,
      safeGroup,
      color
    );
    return { tabIds: sameWinIds, groupId, windowId, groupName: safeGroup, color: resolvedColor };
  }

  async function removeGroups(groups) {
    if (!groups || groups.length === 0) {
      return { closedTabs: 0, closedGroups: 0 };
    }
    const tabIds = [];
    for (const g of groups) {
      const grouped = await chrome.tabs.query({ groupId: g.id });
      for (const t of grouped) tabIds.push(t.id);
    }
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
    }
    return { closedTabs: tabIds.length, closedGroups: groups.length };
  }

  async function closeGroup(groupName = "Antigravity") {
    const safeGroup = assertAllowedGroup(groupName);
    const groups = await chrome.tabGroups.query({ title: safeGroup });
    return removeGroups(groups);
  }

  async function closeAllAgentGroups() {
    const groups = await chrome.tabGroups.query({});
    const agentGroups = groups.filter(g => SAFE_GROUP_RE.test(String(g.title || "").trim()));
    return removeGroups(agentGroups);
  }

  async function listGroups(agentOnly = false) {
    const groups = await chrome.tabGroups.query({});
    const out = [];
    for (const g of groups) {
      const title = g.title || "";
      if (agentOnly && !SAFE_GROUP_RE.test(title.trim())) continue;
      const tabs = await chrome.tabs.query({ groupId: g.id });
      out.push({
        id: g.id,
        title,
        color: g.color || "grey",
        windowId: g.windowId,
        tabCount: tabs.length
      });
    }
    return out;
  }

  if (chrome.action?.onClicked) chrome.action.onClicked.addListener(() => {});
  if (chrome.runtime?.onInstalled) chrome.runtime.onInstalled.addListener(() => {});
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.action === "listAgentGroups") {
        listGroups(true).then(data => sendResponse({ ok: true, data })).catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
      }
      if (msg?.action === "closeAllAgentGroups") {
        closeAllAgentGroups().then(data => sendResponse({ ok: true, data })).catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
      }
      return false;
    });
  }

  globalThis.agyTabs = {
    VALID_COLORS,
    openInGroup,
    groupTab,
    closeGroup,
    closeAllAgentGroups,
    listGroups
  };
})();
