// Goblin Heist — background service worker.
//
// This is the single source of truth for all persistent state (gold,
// mischief level, active heists, the log). Content scripts never touch
// chrome.storage directly — they message this file and render what it
// returns. That keeps gold math and heist bookkeeping race-free across
// multiple tabs on the same site.

const MISCHIEF_LEVELS = {
  chill: { intervalMinMs: 10 * 60000, intervalMaxMs: 18 * 60000, costMin: 40, costMax: 80, graceMs: 8 * 60000 },
  normal: { intervalMinMs: 5 * 60000, intervalMaxMs: 10 * 60000, costMin: 60, costMax: 120, graceMs: 5 * 60000 },
  chaotic: { intervalMinMs: 1.5 * 60000, intervalMaxMs: 4 * 60000, costMin: 100, costMax: 200, graceMs: 2.5 * 60000 },
};

const STARTER_GOLD = 150;
const CHASE_BONUS_GOLD = 15;
const IDLE_GOLD_PER_TICK = 1; // per 30s tick while a tab is visible
const LOG_LIMIT = 50;
const AUTO_RETURN_ALARM = "goblin-auto-return-scan";

function randRange(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function defaultState() {
  return {
    gold: STARTER_GOLD,
    mischief: "normal",
    log: [], // { id, site, label, time, resolution: 'paid'|'chased'|'auto-returned'|'force-returned' }
    // activeHeists: hostname -> array of { id, site, selector, label, cost, stolenAt, graceMs }
    activeHeists: {},
  };
}

async function getState() {
  const { goblinState } = await chrome.storage.local.get("goblinState");
  if (!goblinState) {
    const fresh = defaultState();
    await chrome.storage.local.set({ goblinState: fresh });
    return fresh;
  }
  return goblinState;
}

async function setState(state) {
  await chrome.storage.local.set({ goblinState: state });
  return state;
}

function pushLog(state, entry) {
  state.log.unshift({ id: entry.id, site: entry.site, label: entry.label, time: Date.now(), resolution: entry.resolution });
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}

chrome.runtime.onInstalled.addListener(async () => {
  await getState();
  chrome.alarms.create(AUTO_RETURN_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(AUTO_RETURN_ALARM, { periodInMinutes: 1 });
});

// Backstop sweep: resolves any heist whose grace window has expired even if
// the tab that stole it isn't open right now. Tabs that ARE open also run
// their own precise local timer (see content.js) so the return feels
// instant while the page is up; this alarm just guarantees it can never be
// skipped entirely.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== AUTO_RETURN_ALARM) return;
  const state = await getState();
  const now = Date.now();
  let changed = false;

  for (const site of Object.keys(state.activeHeists)) {
    const remaining = [];
    for (const heist of state.activeHeists[site]) {
      if (now - heist.stolenAt >= heist.graceMs) {
        pushLog(state, { id: heist.id, site, label: heist.label, resolution: "auto-returned" });
        changed = true;
        notifyTabsToRestore(site, heist.id);
      } else {
        remaining.push(heist);
      }
    }
    state.activeHeists[site] = remaining;
  }

  if (changed) await setState(state);
});

async function notifyTabsToRestore(site, heistId) {
  const tabs = await chrome.tabs.query({ url: [`https://x.com/*`, `https://twitter.com/*`] });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: "RESTORE_HEIST", site, id: heistId }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function handleMessage(msg, sender) {
  const state = await getState();

  switch (msg.type) {
    case "GET_STATE": {
      return {
        gold: state.gold,
        mischief: state.mischief,
        mischiefConfig: MISCHIEF_LEVELS[state.mischief],
        log: state.log.slice(0, 10),
        activeHeists: state.activeHeists[msg.site] || [],
      };
    }

    case "SET_MISCHIEF": {
      if (MISCHIEF_LEVELS[msg.level]) state.mischief = msg.level;
      await setState(state);
      return { ok: true, mischief: state.mischief };
    }

    case "HEIST_STARTED": {
      const cfg = MISCHIEF_LEVELS[state.mischief];
      const heist = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        site: msg.site,
        selector: msg.selector,
        label: msg.label,
        cost: randRange(cfg.costMin, cfg.costMax),
        stolenAt: Date.now(),
        graceMs: cfg.graceMs,
      };
      if (!state.activeHeists[msg.site]) state.activeHeists[msg.site] = [];
      state.activeHeists[msg.site].push(heist);
      await setState(state);
      return { ok: true, heist };
    }

    case "REQUEST_PAY": {
      const list = state.activeHeists[msg.site] || [];
      const heist = list.find((h) => h.id === msg.id);
      if (!heist) return { ok: false, reason: "already-resolved", gold: state.gold };
      if (state.gold < heist.cost) return { ok: false, reason: "insufficient-gold", gold: state.gold };

      state.gold -= heist.cost;
      state.activeHeists[msg.site] = list.filter((h) => h.id !== msg.id);
      pushLog(state, { id: heist.id, site: msg.site, label: heist.label, resolution: "paid" });
      await setState(state);
      return { ok: true, gold: state.gold };
    }

    case "REQUEST_CHASE_RESULT": {
      const list = state.activeHeists[msg.site] || [];
      const heist = list.find((h) => h.id === msg.id);
      if (!heist) return { ok: false, reason: "already-resolved", gold: state.gold };

      if (msg.caught) {
        state.gold += CHASE_BONUS_GOLD;
        state.activeHeists[msg.site] = list.filter((h) => h.id !== msg.id);
        pushLog(state, { id: heist.id, site: msg.site, label: heist.label, resolution: "chased" });
        await setState(state);
        return { ok: true, caught: true, gold: state.gold, bonus: CHASE_BONUS_GOLD };
      }
      return { ok: true, caught: false, gold: state.gold };
    }

    case "TICK_IDLE_GOLD": {
      state.gold += IDLE_GOLD_PER_TICK;
      await setState(state);
      return { gold: state.gold };
    }

    case "REQUEST_AUTO_RETURN": {
      const list = state.activeHeists[msg.site] || [];
      const heist = list.find((h) => h.id === msg.id);
      if (!heist) return { ok: false, reason: "already-resolved" };
      if (Date.now() - heist.stolenAt < heist.graceMs) return { ok: false, reason: "not-yet" };

      state.activeHeists[msg.site] = list.filter((h) => h.id !== msg.id);
      pushLog(state, { id: heist.id, site: msg.site, label: heist.label, resolution: "auto-returned" });
      await setState(state);
      return { ok: true };
    }

    case "FORCE_RETURN_ALL": {
      const list = state.activeHeists[msg.site] || [];
      for (const heist of list) {
        pushLog(state, { id: heist.id, site: msg.site, label: heist.label, resolution: "force-returned" });
      }
      const returnedIds = list.map((h) => h.id);
      state.activeHeists[msg.site] = [];
      await setState(state);
      for (const id of returnedIds) notifyTabsToRestore(msg.site, id);
      return { ok: true, returnedIds };
    }

    default:
      return { ok: false, reason: "unknown-message" };
  }
}
