const SITE = "x.com";

const goldEl = document.getElementById("gold");
const mischiefEl = document.getElementById("mischief");
const activeCountEl = document.getElementById("active-count");
const freeAllBtn = document.getElementById("free-all");
const logEl = document.getElementById("log");

const RESOLUTION_LABEL = {
  paid: "paid",
  chased: "caught him",
  "auto-returned": "waited out",
  "force-returned": "freed",
};

function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function render(state) {
  goldEl.textContent = state.gold;
  mischiefEl.value = state.mischief;

  const count = state.activeHeists.length;
  activeCountEl.textContent = count === 0 ? "Nothing stolen right now" : `${count} thing${count === 1 ? "" : "s"} stolen right now`;
  freeAllBtn.disabled = count === 0;

  logEl.innerHTML = "";
  if (state.log.length === 0) {
    const li = document.createElement("li");
    li.className = "gh-p-empty";
    li.textContent = "No heists yet — he's still casing the place.";
    logEl.appendChild(li);
  } else {
    for (const entry of state.log) {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="gh-p-log-label">${escapeHtml(entry.label)}</span>
        <span class="gh-p-log-meta">${RESOLUTION_LABEL[entry.resolution] || entry.resolution} · ${timeAgo(entry.time)}</span>
      `;
      logEl.appendChild(li);
    }
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE", site: SITE });
  render(state);
}

mischiefEl.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({ type: "SET_MISCHIEF", level: mischiefEl.value });
  refresh();
});

freeAllBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "FORCE_RETURN_ALL", site: SITE });
  refresh();
});

refresh();
setInterval(refresh, 4000);
