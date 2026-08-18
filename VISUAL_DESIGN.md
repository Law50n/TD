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

### Phase B — Motion & feedback polish (next, highest ROI, no new assets)

- **Death animations**: enemies currently just vanish + a particle burst.
  Add a brief collapse (scale-down + fade over ~150ms) before removal;
  give boss deaths a multi-stage explosion instead of the same burst as a
  crawler.
- **Tower placement/sell**: instant pop-in/out today. Add a "materialize"
  scale-up with a brief rune-circle flash on placement, and a crumble-fade
  on sell — the Sanctum and gate-seal actions could use a similar beat.
- **Screen transitions**: screens currently hard-swap via
  `display:none`/`flex`. A 150–200ms crossfade (CSS transition on opacity,
  toggled a frame after the display change) between title/game/overlays
  would remove the "slide-projector" feel.
- **HUD counters**: gold/lives currently jump instantly on change. A brief
  count-up/down tween (even a simple `requestAnimationFrame` lerp) reads as
  far more polished than a hard `textContent` swap, and a one-frame flash
  on the changed stat gives free feedback.

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
