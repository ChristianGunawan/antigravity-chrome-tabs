const statusEl = document.getElementById("status");
const groupsEl = document.getElementById("groups");
const closeBtn = document.getElementById("closeAll");

async function refresh() {
  const res = await chrome.runtime.sendMessage({ action: "listAgentGroups" });
  groupsEl.textContent = "";
  const groups = res?.ok ? res.data : [];
  if (groups.length === 0) {
    statusEl.textContent = "No active Antigravity tab groups.";
    statusEl.hidden = false;
    closeBtn.disabled = true;
    return;
  }
  statusEl.hidden = true;
  closeBtn.disabled = false;
  for (const g of groups) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = g.title;
    const count = document.createElement("span");
    count.textContent = `${g.tabCount} tab${g.tabCount === 1 ? "" : "s"}`;
    li.append(name, count);
    groupsEl.append(li);
  }
}

closeBtn.addEventListener("click", async () => {
  closeBtn.disabled = true;
  await chrome.runtime.sendMessage({ action: "closeAllAgentGroups" });
  await refresh();
});

refresh();
