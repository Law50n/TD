# Eternal Spire — Addictive Game Design Roadmap

## TL;DR verdict

The prototype (`index.html`) is not "bad" as an engine — the core loop already
works end to end: place towers, fire at nearest-progress enemy, earn gold,
survive 15 waves, win or lose, best wave saved. It has real production values
for a single file: particles, procedural audio, lore text, upgrades, sell,
pause, speed toggle.

What's missing is the *reason to come back*. Right now it's a single fixed
15-wave run, on one map, with three towers, and "New Game+" just multiplies
the same numbers. Once you've beaten it once, there is nothing left to chase.
That's why it reads as flat/boring rather than "bad" — the skeleton is fine,
the hooks are the gap.

## The addiction loop framework

Every sticky game (Bloons TD, Kingdom Rush, Plants vs. Zombies) is really
three nested loops running at once:

| Horizon | Question the player asks | Eternal Spire today |
|---|---|---|
| Short-term (seconds–minutes) | "Can I survive *this* wave?" | ✅ Present — core combat loop works |
| Mid-term (10–30 min) | "Can I beat this run / my best wave?" | ✅ Present — `bestWave` in localStorage, win/lose screens |
| Long-term (days–weeks) | "What do I unlock next? Where do I rank?" | ❌ Missing entirely |

The long-term loop is the single highest-leverage gap. Everything below is
organized around closing it without throwing away what already works.

## Gap analysis (current implementation → what's holding it back)

Grounded in the actual code in `index.html`:

- **3 towers, 4 enemies, 15 fixed waves** (`TOWER_DEFS`, `ENEMY_DEFS`,
  `WAVE_DEFS`) — enough for one playthrough, not enough for build variety.
- **Wave scaling is flat**: `1 + (waveNum - 1) * 0.15` — linear, no spikes,
  no breather waves, no real "boss" moments (Rift Archon is just a bigger
  stat-stick with the same behavior as everything else).
- **Targeting is fixed**: towers always shoot the enemy furthest along the
  path (`Tower.findTarget`). Reasonable default, but zero player choice —
  no first/last/strongest/closest toggle, so there's no meta-game around it.
- **No mazing**: all non-path tiles are buildable, but the path itself is
  static — players snipe the path, they don't build the path. Choke-point
  design (the thing that makes TD "puzzle-y") isn't possible yet.
- **"New Game+" is just harder numbers** (`gold=150, lives=15` vs.
  `gold=200, lives=20`) — no new content, so replaying feels like a penalty,
  not a reward.
- **Progress persistence is one integer**: `localStorage['eternalspirebest']`.
  No currency, no unlocks, no achievements — nothing to spend a second
  session on.
- **The game ends at a win screen.** 15 waves and done. The stickiest TD
  games never really end — they go endless and chase a leaderboard number.

## Workstream 1 — Meta-progression (the biggest lever)

This is the thing that turns "I beat it" into "I'm coming back tonight."

- **Persistent currency** ("Warden Essence") earned at the end of every run
  (win *or* lose), scaled by wave reached + kills + a small bonus for gold
  banked at death. Stored in `localStorage`, spent outside of runs.
- **Unlock tree**, same data-driven shape as `TOWER_DEFS` so it drops
  straight into the existing architecture:
  ```js
  const META_UPGRADES = [
    { id: 'starting_gold_1', name: 'Warden\'s Reserve', cost: 50, effect: { startGold: 25 } },
    { id: 'tower_frost', name: 'Unlock: Frost Warden', cost: 150, effect: { unlockTower: 'frost' } },
    { id: 'tower_lightning', name: 'Unlock: Storm Caller', cost: 250, effect: { unlockTower: 'lightning' } },
    { id: 'talent_sell_75', name: 'Efficient Teardown', cost: 100, effect: { sellRate: 0.75 } },
  ];
  ```
- **Achievements** as pure flavor + a few gold-bonus unlocks: "Flawless Vigil"
  (clear a run with 0 lives lost), "Speedrunner" (clear wave 15 under N
  minutes), "Archon Slayer x10", "Iron Warden" (win with only 1 tower type).

## Workstream 2 — Strategic depth (make each run's decisions matter)

- **Tower targeting modes**: First / Last / Strongest / Closest, toggle in
  the sidebar per placed tower. Cheap to build (`Tower.findTarget` already
  isolates the targeting logic — swap the comparison), huge depth payoff.
- **Enemies that punish a single strategy** (the code's own scalability
  notes flag this as unfinished — worth doing first):
  - *Flying* — skips ground chokepoints, only certain towers can hit it.
  - *Shielded* — flat damage-absorb per hit until `armorPierce` breaks it.
  - *Splitter* — divides into two weaker enemies on death (classic Bloons
    hook — punishes AoE-only builds).
  - *Stealth* — invisible to Archer/Cannon, visible to Mage only.
- **Real bosses at waves 5 / 10 / 15**: not just higher HP — a telegraphed
  ability (Behemoth periodically stomps and stuns nearby towers 1s; Archon
  channels a heal pulse you must burst through in time). Signal it visually
  before it happens so players can react, not just tank it.
- **Light mazing**: 2–3 tiles per map that can be toggled between two path
  routings (cost gold to "seal" a route), enough to create real chokepoint
  decisions without rebuilding the whole map system.

## Workstream 3 — Replayability infrastructure

- **Endless Mode** after wave 15: procedurally extend `WAVE_DEFS` by
  continuing the multiplier curve and randomly composing enemy groups from
  `ENEMY_DEFS`. This is explicitly what the code's own comment on
  `WaveManager` invites ("generate them procedurally here after wave 15").
  Score = wave reached; this is what a leaderboard hangs off of.
- **2nd and 3rd maps**: `MAP1_PATH` → `MAP2_PATH`, `MAP3_PATH` with
  different choke geometry (a spiral, a split-and-rejoin path). The
  `GameMap` class already takes `pathCoords` as a constructor arg — this is
  close to free with the current architecture.
- **Daily/weekly challenge**: a fixed seed (fixed wave composition +
  modifier like "−25% starting gold" or "2x speed only, no pause") that
  everyone plays that day, so players compare scores instead of just
  chasing their own best.

## Workstream 4 — Risk/reward economy tension

- **Early wave call**: let the player start the next wave before the
  current one fully clears, for a bonus that scales with how early they
  call it (classic Bloons/Kingdom Rush "send it early" tension). Currently
  `startNextWave()` is hard-gated on `gameState === 'between_waves'` — this
  is a deliberate design choice to loosen, not a bug.
- **Pick a stance on banking**: either add mild interest on unspent gold at
  wave-start (rewards patient players, adds a save-vs-spend decision), or
  explicitly keep zero interest to preserve spend-pressure — right now it's
  accidentally the latter. Choose on purpose.
- **One free respec per run**: sell-back is a flat 60% (`getSellValue`),
  which is fine, but a single free full-refund sell per run reduces
  frustration-quits from an early misplaced tower.

## Workstream 5 — Juice & feedback (cheapest wins, do these first)

- Floating damage numbers on hit, a brief screen shake on Behemoth/Archon
  hits and on lives lost, a low-lives vignette/heartbeat past 5 lives.
- A kill-streak/combo callout during dense wave clears — the particle and
  audio systems already exist (`ParticleSystem`, `AudioManager`), this is
  additive, not a rebuild.
- End-of-wave screen previews the *toughest enemy silhouette* in the next
  wave instead of only lore text — gives players a concrete "here's what's
  coming" hook instead of an abstract "wave 8 is scary" feeling.

## Prioritized roadmap

**Phase 1 — ✅ shipped**
Targeting modes (Front/Rear/Strongest/Closest) · early wave-call bonus ·
floating damage numbers + screenshake · 3 new enemy types (Rift Wisp/flying,
Hollow Warden/shielded, Void Splitter). Also fixed a pre-existing bug where
the canvas draw buffer stayed 0x0 until the window was manually resized,
which silently broke tower placement on first load.

**Phase 2 — ✅ shipped**
Meta-currency (Warden Essence, earned every run) + a Sanctum shop with 5
permanent upgrades including an unlockable 4th tower (Frost Warden, slows
enemies) · 4 achievements · telegraphed bosses at waves 5/10/15
(Warden-Breaker stomps and stuns nearby towers, Archon Ravager heals itself,
the Sovereign of the Void alternates both) · light mazing — "The Breach"
gate, sealable for gold to reroute future spawns through a longer, more
exposed detour.

**Phase 3 — ✅ shipped**
Endless Mode — a "Continue into the Void" option on victory that procedurally
generates waves past 15, with a rotating echo of the three named bosses every
third wave · a second map, "The Long Road" (a long, exposed serpentine —
deliberately no mazing gate, trading chokepoints for raw distance), picked on
a new map-select screen before each run · Daily Vigil — a deterministic
per-day map + modifier (Austerity/-25% gold, No Mercy/no pausing, Glass
Cannon/+20% tower cost and damage) so everyone gets the same challenge on the
same day, with a personal best tracked locally. No backend exists here, so
this is a personal daily best, not a live cross-player leaderboard — worth
being upfront about rather than implying one.

Testing Phase 3 also surfaced a real pre-existing bug: `WaveManager`'s
spawn queue was never actually shrinking (entries were flagged `spawned`
in place but never removed), so `waveComplete` could never become true for
any wave with enemies in it. That meant natural wave-clearing — and
therefore `triggerVictory()` — was unreachable from the very first version
of the prototype; only the Phase 1 early-call button (which only checks
`allEnemiesSpawned`) ever let a run progress at all. Fixed by filtering
spawned entries out of the queue each tick.

Ideas for further content, not yet built: a third map, a live leaderboard
(would need a backend), more Sanctum upgrades, more achievements, an
in-run map-specific maze gate for "The Long Road" too.

**Quality pass — ✅ done**
A full review across everything built so far, checking for bugs the
individual phases missed. Found and fixed:

- **Mobile was unplayable.** `.game-sidebar { display: none; }` under
  480px removed the *only* way to select a tower type — no keyboard
  shortcuts exist on touch. Re-docked it as a horizontally-scrolling
  bottom bar instead of hiding it.
- **"New Game+ (Harder)" never actually applied harder settings.** The
  button's `onclick` called `Game.newGame()` with no argument, and the
  internal function read a separate outer `newGamePlus` variable instead
  of its own `isNewGamePlus` parameter — so it silently behaved exactly
  like a plain restart. Removed the redundant variable and wired the
  parameter straight through.
- **Pressing 'P' on the title/lore/how-to screens opened the Pause
  overlay** over a game that didn't exist yet, since `togglePause()` only
  excluded `game_over`/`victory`, not `idle`. Now only fires during
  `playing`/`between_waves`.
- **A HUD display bug in Phase B's own count-tween.** `newGame()`
  "snapped" `displayedGold`/`displayedLives` to the target so a fresh run
  wouldn't visibly tween in from the previous run's numbers — but
  `tweenHUD()` only writes to the DOM when displayed ≠ target, so
  snapping them equal meant the actual on-screen text never updated,
  silently stuck on the static HTML's placeholder "200" whenever real
  starting gold differed from 200 (New Game+, an Austerity daily run,
  Sanctum gold bonuses). Invisible in most testing because normal runs
  start at exactly 200. Fixed by writing the DOM directly at snap time.
- Two minor correctness/cleanup items: projectiles used a hardcoded
  2000px off-screen cleanup bound (could delete one mid-flight on very
  wide canvases) — replaced with a max-lifetime check that doesn't depend
  on display size, and retargeting now picks the *nearest* alive enemy
  instead of the first one in spawn order. Plus a leftover dead variable
  and an always-empty double-filter from early iterations, removed.

Verified with headless Chromium at a real phone viewport (375×667,
touch-emulated) confirming tower placement now works, plus a full
regression across the New Game+, pause, and Daily Vigil fixes.

---

`index.html` in this repo is the current build. Nothing above required a
rewrite — every workstream slotted into the existing `TOWER_DEFS` /
`ENEMY_DEFS` / `WAVE_DEFS` / class structure, which is exactly why it was
worth designing around instead of starting over.
