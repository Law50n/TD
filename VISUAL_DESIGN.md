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

**Shooting motion.** A static full-draw pose still looked static — asked to
make the bow visibly release. Found the existing `recoilOffset`/`recoilVel`
system (present since the original motion-polish pass, used for the
procedural barrel wedge on every tower) is dead: on fire it sets
`recoilVel = -3`, but `recoilOffset` is clamped with `Math.max(0, ...)`,
so a negative velocity can never push it above zero — it's been a no-op
for every tower this whole time, not something this session broke. Rather
than touch that shared system (risk to every other tower for an unrelated
fix), added an independent, self-contained kick timed off state each tower
already carries: `timeSinceFire = 1/fireRate - cooldown` (cooldown resets
to `1/fireRate` the instant `fire()` runs), driving a `kickT` that decays
over 150ms. `drawTowerSprite()` uses it for a backward snap + scale punch.
Verified deterministically — called the function directly at `kickT` 0 /
0.5 / 1.0 and confirmed each stage visibly larger/further back — rather
than trying to catch the real 150ms window on camera by luck.

**A real fire pose replaced the synthetic kick.** The user sent two more
images — the same character right after loosing the arrow: bow empty,
arms in a relaxed follow-through. Added a third sprite key per tower
(`{id}_fire`, alongside `{id}`/`{id}_idle`), extended the kick window to
220ms, and `Tower.draw()` now swaps to the fire sprite for that window
instead of only applying the synthetic snap+scale to the aiming sprite
(the snap+scale still layers on top for extra punch). Falls back to the
old synthetic-only behavior for any tower with no fire art yet. Verified
three ways: a direct isolated call at each of the three sprite keys side
by side, then a rapid-fire real-combat screenshot burst showing the empty-
bow fire frame land exactly at the moment the arrow visibly departs.

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
  preview — ✅ shipped, see "Map & terrain pass" below.
- **Sanctum/achievement cards**: a shimmer sweep on newly-unlocked cards.
- **Font loading**: `Cinzel Decorative` / `Crimson Text` / `MedievalSharp`
  load from a Google Fonts `@import`, which silently fails under network
  restrictions (observed directly in this session's sandboxed testing) and
  falls back to a generic serif with no warning. Self-hosting the font
  files (or at minimum a tighter fallback stack) makes the intended look
  reliable instead of best-effort.

### Phase D — Real art asset pipeline (the big lift, optional) — in progress

This was written as a hypothetical; it's now real for one tower. The
Archer's sprite pipeline (background-removed real art, idle/aim/fire pose
keys, `drawTowerSprite()`, mirroring) shipped above and works exactly as
scoped here — the remaining scope is the same treatment for Mage/Cannon/
Frost and the enemy roster, gated on the user sourcing more images (they're
generating art with paid credits, so this is paced by that, not code).

Everything else below is still procedural canvas drawing — very good
procedural, but still shapes and gradients rather than authored art:

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

### Map & terrain pass — ✅ shipped

Towers/enemies were getting all the attention; the battlefield itself was
still a flat repeating checkerboard with two maps that looked nearly
identical despite very different lore ("shattered ruins" vs. "long exposed
road"). Explored both maps via screenshot first rather than guessing at
scope, which is what surfaced the map-select screen as the biggest gap —
two plain emoji standing in for the actual choice being made.

- **Real path previews on map-select**, replacing the static emoji:
  `renderMapPreview()` draws each map's actual route (start/end dots, the
  gate marker where relevant) onto a small `<canvas>` per card, at map-
  select time — a player can now see the shape of what they're picking
  instead of reading a description and hoping.
- **Per-map ground theming** via a new `theme` field on `MAPS` entries
  (`'ruins'` for The Shattered Gate, `'road'` for The Long Road), threaded
  through `GameMap`'s constructor: different path base color, glow color,
  and buildable-tile texture pattern (scattered hairline cracks + rubble
  flecks for ruins; parallel worn erosion streaks for road). The two maps
  now read as visually distinct battlefields, not the same tile set with a
  different name.
- Texture detail is hashed off `(col, row)` (`tileHash()`) rather than
  re-rolled every frame, so it's stable instead of shimmering — cheap
  (a couple of extra small draws per buildable tile) and confirmed not to
  cost anything: rAF round-trip measured at ~3ms with it running, no
  different from before.
- **Iterated on legibility**: the first texture pass used dark-on-dark
  shading (rgba(0,0,0,...) shadows on tiles that are already near-black),
  which was screenshotted and found to be essentially invisible. Switched
  to light-on-dark highlights instead and raised the opacity until it
  actually reads at real battlefield scale without becoming distracting.
- **Upgraded spawn/exit markers** to pulse (matching the game's existing
  "living glow" language already used for the Breach gate and tower
  plinths) instead of sitting static — a small thing, but everything else
  on the board breathes and the markers were the one exception.

Verified: the map-select previews render correctly for both maps and the
Daily Vigil card; gate-sealing (which reconstructs the map's tiles through
the same code path the `theme` field now flows through) still works with
no errors; full regression suite and an rAF responsiveness check both pass
clean.

**Spooky atmosphere + pot of gold.** User request, with a reference image
of the wider "Derp" franchise's flat/bold-outline art style (a Tamagotchi-
style companion app, not the painterly tower art) — good news, since
environment decoration is exactly what Canvas 2D shapes are actually good
at, unlike character rendering. No real art needed here.

- **Pot of gold** replaces the gold "✦" star at the path's end — a black
  cauldron (flat fill, bold dark outline, no gradient shading, matching the
  reference's style rather than the rest of the battlefield's painted
  look) with coins piled on top and a pulsing warm glow. Reframes the
  fiction to match the goblin enemies already shipped: they're raiding for
  the gold, not marching on a Warden's spire.
- **`drawSpookyAtmosphere()`**: a pale glowing moon, two gnarled bare-tree
  silhouettes framing the bottom corners (procedural trunk + branches, no
  two alike since size/lean mirror by corner), and drifting low-opacity
  ground fog that loops across the bottom of the screen. All screen-space
  (anchored to canvas width/height, not tile coordinates), so none of it
  can ever sit on a buildable tile or block a click — a hazard the tile-
  bound texture pass earlier in this doc had to actively avoid.
- Vignette recolored from neutral black to a mossy green-black tint for
  the "woods at night" mood; layers under the atmosphere elements, over
  the tile texture, so nothing added here fights what shipped earlier in
  this pass.
- **Scope note**: this is atmosphere/decoration on the two existing maps,
  not a full lore rewrite — enemy/wave/achievement text still reads "Void
  Legion." Deliberately left that alone rather than assume the fuller
  goblins-vs-gold reframe was wanted; flagged back to the user rather than
  guessing.

Verified: pot-of-gold and tree-silhouette close-ups confirm both render as
intended at real scale; full regression suite and an rAF check (~5ms, no
regression from the added per-frame draws) both pass clean.

**Atmosphere rework, round 2.** User feedback on the first pass: "I don't
really like what we've got so far but we can work on it. derp art is
simple yet detailed with shading and those clean, black lines" — alongside
a reference image of a forest-spirit scene with real depth (layered
treeline, atmospheric fog) and shaded (not flat) shapes. Read as: keep the
crisp outlines, but the flat silhouettes and scattered fog blobs were
reading as bare/undetailed, not "simple yet detailed."

- **Moon**: flat fill → radial gradient (lit-sphere look) with a soft glow
  and a crisp dark stroke, so it has actual shading instead of being a
  flat disc.
- **Trees**: the trunk+branch geometry was rebuilt twice. First rewrite
  used a closed blade-shaped trunk with mirrored ±dir chevron branches at
  even heights — screenshotted and it read as a fern/reed, not a tree.
  Rebuilt again with a genuinely tapered trunk that stops partway up, and
  5 independently-seeded branches (`tileHash`-driven angle/length/bend per
  branch, some with a forking twig) so no two branches mirror each other —
  this is what makes it read as a gnarled winter tree instead of a
  symmetric pattern. Branch strokes use a linear gradient (dark at the
  base, lighter toward the tips) for the same shaded-not-flat treatment as
  the moon.
- **Distant treeline**: added 7 small hazy trees along the top edge for
  depth (the original had only the 2 foreground corner trees, so the top
  of the screen was empty). First attempt anchored them at `y = size *
  0.15` — with the trunk and branches growing upward from that point, most
  of each tree rendered above y=0 and off-canvas; only faint tufts were
  visible. Fixed by anchoring lower (`y = size * 1.05`) so the full tree
  fits in frame, and swapped the color from a near-black `#1a2a1c` (which
  barely showed against the equally-dark sky) to a lighter grey-green
  `#3a4a42` at higher opacity — distant objects reading lighter/hazier is
  also just correct atmospheric perspective.
- **Fog**: flat drifting ellipse blobs → a linear-gradient wash rising
  from the bottom of the screen (real atmosphere, not discrete shapes)
  plus a few soft radial-gradient wisps layered on top for drift/motion.

Verified: close-ups of the moon, a single foreground tree, and the full
top treeline confirm the shading and branch-asymmetry read correctly at
real scale; full-board screenshots of both maps confirm the composition
holds up together, not just in isolated crops; full regression suite and
an rAF check (2.5-4.8ms, no regression) both pass clean.

**Atmosphere rework, round 3 — rounded canopy trees.** Round 2 still
missed: "I still don't really like the art/style, i was thinking something
more like the attached," with a reference showing soft rounded tree
canopies (layered fluffy clumps, not bare branches), ambient-occlusion
shadows grounding every prop, and a warmer/softer painted look overall.
That's a different tier of fidelity than hand-coded Canvas shapes can
fully match — it reads like painted/illustrated tile art, not primitives
— so this was scoped explicitly as a **stopgap**: push the procedural
technique as far as it reasonably goes now, with real generated tile art
(the same reference-image pipeline used for the archer sprite) as the
follow-up once there are image credits to spend on environment art
instead of towers.

- **`_drawTreeCluster()`** replaces the bare-branch `_drawTreeSilhouette`
  entirely: an ambient-occlusion shadow (radial-gradient ellipse) grounds
  the tree, a short tapered trunk, and a lumpy rounded canopy — an
  irregular closed blob path (8 `tileHash`-seeded bumps joined by
  quadratic curves through their midpoints, not a plain circle) filled
  with a directional radial gradient (light upper-left, dark lower-right,
  the same "shaded volume" cue as the moon) and one clean dark outline
  around the whole silhouette. A few small light flecks scattered inside
  read as leaf-clump texture.
- **`_drawRockCluster()`**: same AO-shadow + lumpy-blob + gradient +
  outline recipe at rock scale (6 more angular bumps, a cool grey-stone
  palette), scattered along the bottom edge between the trees for the
  grounded prop density the reference has.
- Two color sets (`TREE_HUE_NEAR`/`TREE_HUE_FAR`) instead of one flat
  color per tree: the foreground corner trees are richer/more saturated,
  the treeline trees are desaturated blue-grey-green — lighter reading as
  farther away is real atmospheric perspective, not just an alpha drop.
- Ground fog re-tinted from a swampy green wash to a cooler pale
  lavender-grey mist, closer to the reference's tone without touching the
  core tile/path palette (which many other systems — theme colors, the
  selected-tile highlight, map-select previews — depend on and weren't
  part of this feedback).

Verified: full-board screenshots of both maps and a foreground-tree
close-up confirm the rounded, shaded, AO-grounded look reads correctly;
full regression suite and an rAF check (2.7ms, no regression) both pass
clean.

## Suggested order

**B → C → E → D.** Motion and chrome polish compound with what already
shipped and need no new assets; accessibility fixes are cheap and easy to
forget once things "look done"; real art (D) is the biggest lift and worth
scoping as a deliberate follow-up project rather than squeezing into the
next quick pass.
