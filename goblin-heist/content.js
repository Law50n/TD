// Goblin Heist — content script.
//
// Runs on x.com/twitter.com. Periodically "steals" a nav element by
// injecting a CSS rule that hides it (keyed to a stable attribute
// selector, not a specific DOM node — X re-renders its nav via React
// constantly, and a node reference would go stale the moment that
// happens). Shows a ransom toast; the element comes back when the user
// pays gold, catches the goblin in a short chase mini-game, the grace
// timer runs out, or they hit the always-free escape hatch in the popup.

const SITE = "x.com"; // x.com and twitter.com share one economy/log bucket

// Best-effort selectors for X's left nav. These are guesses at X's current
// data-testid attributes and will drift if X changes their markup — the
// generic fallback below (findGenericCandidates) is what keeps this
// working even when a guess goes stale, by discovering nav items live and
// labeling them from their own text/aria-label.
const KNOWN_SELECTORS = [
  { selector: '[data-testid="AppTabBar_Home_Link"]', label: "Home" },
  { selector: '[data-testid="AppTabBar_Explore_Link"]', label: "Explore" },
  { selector: '[data-testid="AppTabBar_Notifications_Link"]', label: "Notifications" },
  { selector: '[data-testid="AppTabBar_DirectMessage_Link"]', label: "Messages" },
  { selector: '[data-testid="AppTabBar_Communities_Link"]', label: "Communities" },
  { selector: '[data-testid="AppTabBar_Grok_Link"]', label: "Grok" },
  { selector: '[data-testid="AppTabBar_Profile_Link"]', label: "Profile" },
  { selector: '[data-testid="SideNav_NewTweet_Button"]', label: "the Post button" },
  { selector: '[data-testid="SideNav_AccountSwitcher_Button"]', label: "your account switcher" },
];

const styleEl = (() => {
  const el = document.createElement("style");
  el.id = "gh-heist-styles";
  document.documentElement.appendChild(el);
  return el;
})();

const localAutoReturnTimers = new Map(); // heistId -> timeoutId
let toastLayer = null;
let mischiefConfig = null;
let nextHeistTimer = null;

// State synced from background — activeHeists starts empty and is filled
// in by init() below before any timer can actually read it.
let activeHeists = [];

function cssEscapeAttr(value) {
  return value.replace(/["\\]/g, "\\$&");
}

function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  return !!el.offsetParent || getComputedStyle(el).position === "fixed";
}

function deriveSelector(el) {
  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${cssEscapeAttr(testId)}"]`;

  if (el.tagName === "A" && el.getAttribute("href")) {
    const href = el.getAttribute("href");
    if (href.startsWith("/") && href.length < 40) return `a[href="${cssEscapeAttr(href)}"]`;
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return `[aria-label="${cssEscapeAttr(ariaLabel)}"]`;

  if (el.id) return `#${CSS.escape(el.id)}`;

  return null; // not stable enough to safely target
}

function labelFor(el) {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const text = el.innerText && el.innerText.trim();
  if (text) return text.slice(0, 24);
  const title = el.querySelector("title");
  if (title && title.textContent) return title.textContent.trim();
  return "a button";
}

function findGenericCandidates() {
  const nodes = document.querySelectorAll('nav a[href], nav [role="link"], nav [role="tab"], nav button');
  const out = [];
  for (const el of nodes) {
    if (!isVisible(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 400 || rect.height > 200) continue; // skip whole-nav containers
    if (el.closest("form")) continue;
    const selector = deriveSelector(el);
    if (!selector) continue;
    out.push({ selector, label: labelFor(el), el });
  }
  return out;
}

function activeSelectorSet() {
  return new Set(activeHeists.map((h) => h.selector));
}

function pickTarget() {
  const taken = activeSelectorSet();
  const candidates = [];

  for (const known of KNOWN_SELECTORS) {
    if (taken.has(known.selector)) continue;
    const el = document.querySelector(known.selector);
    if (el && isVisible(el)) candidates.push({ ...known, el });
  }

  for (const generic of findGenericCandidates()) {
    if (taken.has(generic.selector)) continue;
    if (candidates.some((c) => c.selector === generic.selector)) continue;
    candidates.push(generic);
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function send(type, extra) {
  return chrome.runtime.sendMessage({ type, site: SITE, ...extra });
}

function injectHideRule(heist) {
  styleEl.appendChild(
    Object.assign(document.createElement("style"), {
      id: `gh-rule-${heist.id}`,
      textContent: `${heist.selector}{display:none!important;}`,
    })
  );
}

function removeHideRule(heistId) {
  document.getElementById(`gh-rule-${heistId}`)?.remove();
}

function scheduleLocalAutoReturn(heist) {
  const msLeft = heist.stolenAt + heist.graceMs - Date.now();
  const t = setTimeout(async () => {
    const res = await send("REQUEST_AUTO_RETURN", { id: heist.id });
    if (res.ok) resolveHeistUI(heist.id);
  }, Math.max(0, msLeft));
  localAutoReturnTimers.set(heist.id, t);
}

function clearLocalAutoReturn(heistId) {
  const t = localAutoReturnTimers.get(heistId);
  if (t) clearTimeout(t);
  localAutoReturnTimers.delete(heistId);
}

function resolveHeistUI(heistId) {
  removeHideRule(heistId);
  clearLocalAutoReturn(heistId);
  activeHeists = activeHeists.filter((h) => h.id !== heistId);
  removeToast(heistId);
}

// ---- goblin sprite animation ----
function spriteUrl() {
  return chrome.runtime.getURL("icons/goblin48.png");
}

function spawnSprite() {
  const img = document.createElement("img");
  img.src = spriteUrl();
  img.className = "gh-sprite";
  img.alt = "";
  document.body.appendChild(img);
  return img;
}

function runInAndSteal(target) {
  const rect = target.el.getBoundingClientRect();
  const sprite = spawnSprite();
  const startX = Math.random() < 0.5 ? -60 : window.innerWidth + 60;
  const startY = window.innerHeight - 80;
  sprite.style.left = `${startX}px`;
  sprite.style.top = `${startY}px`;

  requestAnimationFrame(() => {
    sprite.style.transition = "left 0.7s ease-in, top 0.7s ease-in";
    sprite.style.left = `${rect.left + rect.width / 2 - 24}px`;
    sprite.style.top = `${rect.top + rect.height / 2 - 24}px`;
  });

  setTimeout(async () => {
    sprite.classList.add("gh-grab");
    const res = await send("HEIST_STARTED", { selector: target.selector, label: target.label });
    if (!res.ok) {
      sprite.remove();
      return;
    }
    activeHeists.push(res.heist);
    injectHideRule(res.heist);
    scheduleLocalAutoReturn(res.heist);
    showToast(res.heist);

    setTimeout(() => {
      const fleeX = Math.random() < 0.5 ? -60 : window.innerWidth + 60;
      sprite.style.transition = "left 0.6s ease-in, top 0.6s ease-in, opacity 0.3s ease-in 0.3s";
      sprite.style.left = `${fleeX}px`;
      sprite.style.top = `${window.innerHeight - 60}px`;
      sprite.style.opacity = "0";
      setTimeout(() => sprite.remove(), 650);
    }, 250);
  }, 750);
}

// ---- chase mini-game ----
function startChase(heist, toastEl) {
  toastEl.classList.add("gh-toast-chasing");
  const sprite = spawnSprite();
  sprite.classList.add("gh-chase-sprite");
  const waypoints = Array.from({ length: 4 }, () => ({
    x: 40 + Math.random() * (window.innerWidth - 80),
    y: 40 + Math.random() * (window.innerHeight - 80),
  }));

  let caught = false;
  sprite.addEventListener("click", () => {
    caught = true;
    sprite.classList.add("gh-caught");
  });

  const segMs = 550;
  waypoints.forEach((wp, i) => {
    setTimeout(() => {
      if (!sprite.isConnected) return;
      sprite.style.transition = `left ${segMs}ms linear, top ${segMs}ms linear`;
      sprite.style.left = `${wp.x}px`;
      sprite.style.top = `${wp.y}px`;
    }, i * segMs);
  });

  setTimeout(async () => {
    sprite.remove();
    toastEl.classList.remove("gh-toast-chasing");
    const res = await send("REQUEST_CHASE_RESULT", { id: heist.id, caught });
    if (res.caught) {
      flashToast(toastEl, `Caught him! +${res.bonus} gold, ${heist.label} is back.`, true);
      setTimeout(() => resolveHeistUI(heist.id), 1200);
    } else {
      flashToast(toastEl, "Too slow — ransom still stands.", false);
    }
  }, waypoints.length * segMs + 150);
}

// ---- ransom toast UI ----
function ensureToastLayer() {
  if (!toastLayer) {
    toastLayer = document.createElement("div");
    toastLayer.id = "gh-toast-layer";
    document.body.appendChild(toastLayer);
  }
  return toastLayer;
}

function flashToast(toastEl, message, good) {
  const msgEl = toastEl.querySelector(".gh-toast-msg");
  if (msgEl) msgEl.textContent = message;
  toastEl.classList.toggle("gh-toast-good", good);
  toastEl.classList.toggle("gh-toast-bad", !good);
}

function removeToast(heistId) {
  document.getElementById(`gh-toast-${heistId}`)?.remove();
}

function showToast(heist) {
  const layer = ensureToastLayer();
  const el = document.createElement("div");
  el.className = "gh-toast";
  el.id = `gh-toast-${heist.id}`;
  el.innerHTML = `
    <img class="gh-toast-icon" src="${spriteUrl()}" alt="">
    <div class="gh-toast-body">
      <div class="gh-toast-msg">🧌 swiped <b>${escapeHtml(heist.label)}</b>! Ransom: ${heist.cost} gold</div>
      <div class="gh-toast-timer"></div>
      <div class="gh-toast-actions">
        <button class="gh-btn gh-btn-pay">Pay ${heist.cost}</button>
        <button class="gh-btn gh-btn-chase">Chase him</button>
      </div>
    </div>
    <button class="gh-toast-min" title="Minimize">–</button>
  `;
  layer.appendChild(el);

  el.querySelector(".gh-btn-pay").addEventListener("click", async () => {
    const res = await send("REQUEST_PAY", { id: heist.id });
    if (res.ok) {
      flashToast(el, `Paid up. ${heist.label} is back.`, true);
      setTimeout(() => resolveHeistUI(heist.id), 900);
    } else {
      el.classList.add("gh-shake");
      setTimeout(() => el.classList.remove("gh-shake"), 400);
      flashToast(el, "Not enough gold — try chasing him instead.", false);
    }
  });

  el.querySelector(".gh-btn-chase").addEventListener("click", () => startChase(heist, el));
  el.querySelector(".gh-toast-min").addEventListener("click", (e) => {
    e.stopPropagation();
    el.classList.add("gh-toast-mini");
  });
  el.addEventListener("click", () => el.classList.remove("gh-toast-mini"));

  const timerEl = el.querySelector(".gh-toast-timer");
  const tick = () => {
    if (!el.isConnected) return;
    const msLeft = heist.stolenAt + heist.graceMs - Date.now();
    if (msLeft <= 0) {
      timerEl.textContent = "returning him now…";
      return;
    }
    const s = Math.ceil(msLeft / 1000);
    timerEl.textContent = `auto-returns in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    setTimeout(tick, 1000);
  };
  tick();
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- heist scheduling ----
function scheduleNextHeist() {
  if (nextHeistTimer) clearTimeout(nextHeistTimer);
  if (!mischiefConfig) return;
  const delay = mischiefConfig.intervalMinMs + Math.random() * (mischiefConfig.intervalMaxMs - mischiefConfig.intervalMinMs);
  nextHeistTimer = setTimeout(async () => {
    const target = pickTarget();
    if (target) runInAndSteal(target);
    scheduleNextHeist();
  }, delay);
}

// ---- idle gold ----
function startIdleGoldTicker() {
  setInterval(() => {
    if (document.visibilityState === "visible") send("TICK_IDLE_GOLD", {});
  }, 30000);
}

// ---- messages pushed from background (alarm-based or popup-triggered) ----
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "RESTORE_HEIST" && msg.site === SITE) {
    resolveHeistUI(msg.id);
  }
});

// ---- boot ----
(async function init() {
  const state = await send("GET_STATE", {});
  mischiefConfig = state.mischiefConfig;
  activeHeists = state.activeHeists;

  for (const heist of activeHeists) {
    injectHideRule(heist);
    scheduleLocalAutoReturn(heist);
    showToast(heist);
    document.getElementById(`gh-toast-${heist.id}`)?.classList.add("gh-toast-mini");
  }

  scheduleNextHeist();
  startIdleGoldTicker();
})();
