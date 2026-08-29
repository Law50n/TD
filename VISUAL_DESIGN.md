# Eternal Spire — Visual Design Roadmap

## Where this started

The UI chrome — title screen, HUD, sidebar, overlays — already had a
considered identity: `Cinzel Decorative` for display type, a gold/purple/cyan
palette, glow effects, octagon-cut buttons. What let it down was the actual
battlefield: towers and enemies were flat-filled circles with an emoji on
top, tiles were solid checkerboard squares, and the mazing gate was
literally a 🚧 road-work-barrier emoji sitting in the middle of a dark
fantasy map. The menus looked shipped; the game itself looked like a
prototype. That mismatch is what read as "basic."

## What just shipped (quick pass, this session)

All in the canvas rendering layer, no new assets, no architecture changes:

- **Towers**: octagonal plinth (echoes the menu buttons' cut-corner motif)
  with radial shading, a lit-sphere body instead of a flat disc, a tapered
  barrel wedge with a glowing muzzle tip instead of a bare line, diamond
  upgrade gems instead of plain dots, and a ground shadow for weight.
- **Enemies**: lit-sphere body shading, a facing "nose" wedge computed from
  actual movement direction so creatures read as going somewhere, a motion
  streak on fast enemies and an armor-plate ring on tanky ones (both driven
  off the existing `speed`/`armor` stats, so new enemy defs pick this up
  automatically), a ground shadow.
- **The path**: flagstone tick marks spaced along its length so it reads as
  a paved road, not a purple blob.
- **The map**: a single radial vignette per frame darkens the edges for
  depth, buildable tiles got a faint inner panel edge.
- **The Breach gate**: replaced the 🚧 emoji with a hand-drawn rotating
  arcane rune-seal (hexagonal ring, spokes, glowing core) — thematically
  consistent, and it now reads as *magic* rather than roadworks.

All additive to `draw()` methods; verified with a full headless regression
pass (towers still fire, waves still clear, no console errors) plus visual
screenshots before/after.

## Roadmap to "professional and complete"

### Phase B — Motion & feedback polish — ✅ shipped

- **Death animations**: enemies now collapse (shrink + fade over ~0.3s,
  0.6s for bosses) instead of vanishing on the spot — they're kept in the
  `enemies` array during the animation but already excluded from
  targeting/collision by the existing `isDead` checks, so nothing re-hits
  a dying enemy. Boss deaths get three staged bursts (explode → glow-color
  burst → white flash-ring) plus a bigger screenshake instead of the same
  14-particle pop as a crawler.
- **Tower placement/sell**: placement now does a quick overshoot scale-in
  (`ease-out-back`) plus a rune-ring + spark burst; selling scatters the
  tower's own color as it's removed instead of an instant pop.
- **Screen transitions**: `.screen.active` and `.overlay-panel` both get a
  short fade/scale-in `@keyframes` animation (respects
  `prefers-reduced-motion`) — no JS changes needed since `showScreen()`
  already just toggles the `active` class.
- **HUD counters**: gold/lives are now owned by a per-frame `tweenHUD()`
  that counts the displayed number toward the real one and flashes
  green/red on the direction of change, instead of `updateHUD()` writing
  `textContent` instantly.

Verified with headless Chromium: materialize/sell/death frames captured
mid-animation, and — given this codebase's history of a subtle
wave-completion bug — specifically re-confirmed that victory, achievement
unlocks, and the Endless Mode transition still fire correctly with the
death-animation delay in the enemy cleanup path.

### Phase D — Character art: Goblins & Derps (style proof, in progress)

Direction from actual reference art (a goblin — green skin, pointy ears, a
cracked eggshell "cap," big round eyes, fangs — and a "Derp" — pale rounded
head, colored beanie, ski goggles). No image-generation tool is available,
so this is procedural Canvas 2D art (flat fills, bold black outlines)
matching that style rather than pixel-identical reproductions; built so a
real sprite can drop in later per-unit via `ctx.drawImage()` if art files
ever exist for a given type.

Shipped as a style proof on one tower and one enemy before expanding to the
rest of the roster:

- **Archer → Derp.** `drawDerpHead()` replaces the plain lit-sphere body:
  pale head, slight derpy tilt, red/green beanie band, purple ski goggles,
  a small worried mouth. The aim-direction barrel now originates from the
  edge of the head instead of dead-center so it reads as a held weapon
  instead of slicing across the face.
- **Crawler → Goblin.** `drawGoblinFace()` replaces the sphere: pointy ears,
  a jagged cracked-eggshell cap over the crown, big round eyes, small fangs.
  The old "facing nose" wedge is skipped for it since the face itself is
  already directional.
- Both helpers live in the shared render-helpers section and take a color
  options object, so the remaining 3 tower types and ~10 enemy types
  (including bosses) can reuse them with different palettes/accessories
  rather than needing bespoke code each.

**Iterated after user feedback:** the first pass read as "a seal, not a
Derp" — a plain round head is exactly the wrong silhouette. Reworked
`drawDerpHead()` against actual Derp reference art: the head is now an
elongated egg (not a circle) sitting on a visible short neck, tilted more
sharply, with deliberately mismatched "googly" eyes (different sizes,
different positions — the defining Derp trait) and goggles pushed up onto
the forehead rather than covering the eyes, per the reference. Also
stripped the inherited plinth glow (`shadowBlur`) before drawing the head
and enlarged it slightly — at true battlefield scale a colored blur haze
was washing the small face into an unreadable blob.

**Second round of feedback:** "not at all, this is just a better quality
version of your first attempt" — a floating head on a plinth reads as a
portrait, not a figure. The reference the user wants (a full illustrated
"Archer Tower" card: legs, a torso in a shirt, arms drawing a bow with a
visible string) is a full character, not a bust. Rebuilt the Archer as
`drawDerpArcher()`: legs planted on the plinth, a torso/shirt ellipse, the
Derp head on top, and — the main addition — a bow rig that rotates to face
the aim direction: an off-arm to the grip, a bow drawn as a real curved arc
(a circle arc centered behind the hand, so it bulges toward the archer with
tips angled forward — not a straight wedge), a taut string pulled back to
the draw hand, and a nocked arrow with a triangular head and V-fletching.
`Projectile.draw()` now branches on `towerType === 'archer'` to render an
actual arrow in flight (shaft + head + fletching, oriented along the
velocity vector) instead of a glowing dot. Verified in an isolated render
at four aim angles for the rig geometry, then in real combat — an enemy
visibly takes an arrow mid-flight and its health bar drops — plus the full
regression suite still passes clean.

**Considered a framework switch (Phaser 3), declined.** A suggestion came
in to rebuild tower AI/projectiles/animation on Phaser. Reviewed and
declined: the sample code re-implements targeting, fire-rate cooldowns, and
homing projectiles that `Tower.findTarget()`/`Projectile` already do, and
its `scene.add.sprite('archer')` call still needs a real image asset loaded
first — Phaser doesn't generate art, so it doesn't touch the actual
bottleneck (no image-generation tool available). A migration would mean
porting achievements/meta-progression/Daily Vigil/Endless Mode off the
current loop for zero visual gain. Stayed on plain Canvas 2D.

**Finished the Goblin to match:** the Crawler had a face but no body — legs,
a walk cycle, a tail, or a gesture. Added `drawGoblinLimbs()`: two legs that
alternate via the existing `animTime` for a walk cycle, planted just below
the body so they don't creep into the fangs, and a raised clawed hand held
clearly beside the head (a fixed spot, since the face itself doesn't rotate
with facing direction) matching the reference's gesture. A tail was tried
first but at battlefield scale it was rendered mostly *underneath* the
body's own fill and read as noise fused to a leg — cut rather than shipped
half-legible. Iterated on hand placement too: the first pass sat right on
the ear and read as a stray bump; moved it further out and enlarged it
until it clearly reads as a separate clawed hand.

Both the Archer/Derp and Crawler/Goblin are now full-body figures rather
than floating heads/faces, closing out this style pass before it expands
to the other 3 towers and remaining enemy types.

**Third round on the Archer — real sprite art.** Still "not as good as it
needs to be" after two procedural passes; the actual gap was medium
(painterly gradients, fur texture) that Canvas 2D shapes can't produce.
The user generated real illustrated art and sent it directly in chat.
Pulled it out of the session's own conversation log (`~/.claude/projects/
.../*.jsonl` stores each attachment's base64 inline — no separate upload
folder to check) rather than asking for a re-send, background-removed it
with a border-flood-fill (`scipy.ndimage.label`, keeping only white regions
connected to the image edge — so enclosed whites like the eyes and the
bow's string-gap survive correctly instead of an in/out global threshold
punching holes in light-colored interior art), cropped off the source's
own baked-in platform (its fine rune linework collapses into a solid green
blob at true battlefield scale — kept the game's own simpler plinth glow,
which stays legible small), and embedded the result as base64 to keep the
single-file architecture.

New infra: `TOWER_SPRITE_SRC`/`TOWER_SPRITES` (id → `Image` + loaded flag)
and `drawTowerSprite()`. Sprites are static side-profile art, so they don't
rotate through arbitrary aim angles like the procedural rig — they mirror
horizontally to face the target's side, same as most 2D TD games with
illustrated units (`TOWER_SPRITE_NATIVE_FACING_LEFT` records which way each
source pose already faces so the mirror only fires when it needs to;
verified explicitly at angle 0 and π before trusting it in combat).
`Tower.draw()` uses the sprite when loaded and falls back to
`drawDerpArcher()` otherwise, so every other tower keeps working exactly as
before with zero art. The user then sent two more angles of the same
character; one (a relaxed hold rather than a taut draw) became a second
sprite (`archer_idle`) shown while the tower has no target, swapping to the
in-combat sprite the instant `this.target` is set — small bit of life for
free from art already on hand, verified by screenshotting both states.

**Bug found and fixed along the way:** `updateGame()` — which drives
`Tower.update()`, and with it the placement materialize animation — only
runs while `gameState === 'playing'`. A tower placed before the first wave,
or between waves, therefore never advanced `spawnAge` past 0, which is
scale/alpha 0 in the materialize animation — i.e. it stayed completely
invisible until the next wave started. Pre-existing, not specific to the
new art (the plain sphere body was just as invisible under the same
condition), only surfaced now because this pass screenshotted that exact
pre-wave window for the first time. Fixed by ticking the cosmetic parts of
`Tower.update()` (spawn/recoil) every frame regardless of game state.

### Phase C — UI chrome refinement

- **Tower cards**: hover-lift + glow micro-interaction, an icon "chip"
  background behind the emoji instead of it floating on flat panel color.
- **Map-select cards**: replace the static emoji with a tiny rendered path
  preview (a mini canvas or inline SVG tracing each map's actual route) —
  high-value because it lets the choice be seen, not just described.
- **Sanctum/achievement cards**: a shimmer sweep on newly-unlocked cards.
- **Font loading**: `Cinzel Decorative` / `Crimson Text` / `MedievalSharp`
  load from a Google Fonts `@import`, which silently fails under network
  restrictions (observed directly in this session's sandboxed testing) and
  falls back to a generic serif with no warning. Self-hosting the font
  files (or at minimum a tighter fallback stack) makes the intended look
  reliable instead of best-effort.

### Phase D — Real art asset pipeline (the big lift, optional)

Everything above is procedural canvas drawing — very good procedural, now,
but still shapes and gradients rather than authored art. The next real
jump in perceived quality is:

- Hand-drawn or AI-generated sprite sheets for towers/enemies/bosses,
  swapped in via `ctx.drawImage()` — the draw methods already isolate
  "where the sprite goes," so this is a data/asset change more than a
  rewrite (see the `SCALABILITY NOTE` comments left in `Tower.draw()` and
  `Enemy.draw()` for exactly where).
  Texture-based tiles instead of flat-color rectangles.
- A sprite-based particle system (small glowing textures instead of plain
  filled circles) for explosions/trails.

This is a genuinely bigger scope — asset creation plus a loading/atlas
system — and worth treating as its own project rather than folding into a
"quick pass," but it's the difference between "very polished procedural"
and "looks like a funded indie release."

### Phase E — Accessibility & robustness (cheap, easy to skip by accident)

- Health bars are green/orange/red only — add a shape or pattern cue so
  they're readable without color vision.
- Respect `prefers-reduced-motion` for screenshake and the busier particle
  effects.
- Touch-target audit on the sidebar/HUD buttons at the mobile breakpoint
  (sidebar already hides under 480px; worth confirming what replaces tower
  selection there).
- The font-loading fix from Phase C also functions as a robustness fix,
  not just a polish one.

## Suggested order

**B → C → E → D.** Motion and chrome polish compound with what already
shipped and need no new assets; accessibility fixes are cheap and easy to
forget once things "look done"; real art (D) is the biggest lift and worth
scoping as a deliberate follow-up project rather than squeezing into the
next quick pass.
