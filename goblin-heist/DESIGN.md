# Goblin Heist — design notes

## The pitch

Not a game you go play — a goblin that lives in your browser and messes
with sites you're already using. Every so often he steals a UI element
(a nav tab, a button) off the page and holds it for gold ransom. You pay
him, chase him down in a five-second mini-game, or just wait out the
grace timer and get it back for free. Virtual gold only — no real money,
no payment processing, no gambling-law surface. Closer to a prank
extension than a "game," which is exactly the point: Real World Goblins
doesn't have a locked-down NFT spec yet, and this doesn't need one to be
fun today.

## Why a browser extension instead of a page

Everything else in this repo (`index.html`, the Eternal Spire tower
defense) is a destination — you have to go open it. This is the opposite:
it inserts itself into a site you already have open, which is a genuinely
different shape of "game" than anything else here, in the same spirit as
Line Rider or Angry Birds being one dead-simple mechanic rather than a
system. The mechanic here is "an element you rely on is gone until you
do something about it."

## Architecture

- **`background.js`** (MV3 service worker) is the single source of truth.
  It owns `chrome.storage.local`: gold balance, mischief level, the
  active-heists list, and a capped log. Content scripts never touch
  storage directly — they message background and render what comes back.
  This avoids gold-balance races when the same site is open in multiple
  tabs.
- **`content.js`** runs on `x.com` / `twitter.com`. It picks a target,
  runs the goblin-runs-in animation, and on arrival asks background to
  start a heist. Once background confirms, it hides the element and shows
  a ransom toast.
- **Hiding is CSS-rule-based, not node-based.** X is a React SPA that
  re-renders its nav constantly; holding a reference to the actual DOM
  node and setting `display:none` on it would go stale the moment React
  swaps the node out. Instead, a heist stores a *selector string*
  (`[data-testid="..."]`, or `a[href="/notifications"]`, etc.) and an
  injected `<style>` rule targets that selector. The rule keeps working
  regardless of how many times the underlying node gets replaced, and
  removing the rule is the entire "give it back" operation.
- **`popup.js`** is a thin viewer: gold, mischief level, active-heist
  count, recent log, and the escape hatch.

## Selector strategy (and why it's built to degrade gracefully)

`KNOWN_SELECTORS` in `content.js` is a best-effort guess at X's current
`data-testid` attributes for Home / Notifications / Messages / etc.
These **will drift** — X changes their markup without notice, and I
can't verify these live against the production site from here. That's
why target selection always merges known selectors with
`findGenericCandidates()`, which discovers visible nav links/buttons
directly from the live DOM and labels them from their own `aria-label`
or text. If every known selector goes stale tomorrow, the goblin still
finds things to steal — it just picks them generically instead of
using the nicer known label. Worth a pass with real devtools open on
x.com to tighten up `KNOWN_SELECTORS` once this is actually loaded
there.

Selector derivation for a discovered element prefers, in order:
`data-testid` → `href` (for anchors, since X's own route paths like
`/home` are far more stable than any generated class name) →
`aria-label` → `id` → give up (skip that candidate rather than risk an
unstable selector that could hide the wrong thing later).

## Safety guardrails (deliberate, not incidental)

- **Never steals into a form.** `findGenericCandidates()` skips anything
  inside `<form>` and any element bigger than a small button/link, so it
  can't accidentally swallow a whole toolbar or a text field.
- **Grace auto-return.** Every heist returns itself for free after a
  timer (2.5–8 min depending on mischief level) even if the user does
  nothing. This is never a genuine lockout.
- **The popup's "Free them all" button always works, for free**,
  regardless of gold balance. It calls `FORCE_RETURN_ALL` directly — no
  cost, no cooldown. This is the actual safety property: no matter what
  else is broken or misconfigured, the user can always get their site
  back.
- **Client-side only.** No network calls, no server, no account system.
  The goblin only ever touches the DOM of the user's own browser tab —
  same trust model as an ad blocker or a dark-mode extension, not a
  modification visible to anyone else.

## Economy (virtual gold only)

- Starting balance: 150 gold.
- Idle trickle: +1 gold per 30s while a matched tab is visible (~2/min).
- Chase mini-game success: item returned free + 15 gold bonus — the
  skill-based alternative to grinding idle gold.
- Ransom cost and heist frequency both scale with the mischief level
  (chill / normal / chaotic), configurable in the popup.

## What's deliberately not here yet

- **Only x.com/twitter.com.** Adding a new site is: a `SITE_CONFIGS`-style
  selector list, a `matches` entry in `manifest.json`, and a
  `host_permissions` entry. The architecture doesn't need to change.
- **Real art.** The goblin sprite is a placeholder PNG generated from
  scratch (`icons/goblin*.png`, drawn via a small Node script, no
  external assets) approximating the derp style — pale cracked mask,
  green skin, round eyes. Swap in real art from Funeral by replacing
  those files at the same paths; nothing else needs to change since the
  sprite element just points at `icons/goblin48.png`.
- **No tie-in to the NFT/token side yet.** Gold is intentionally inert —
  it doesn't map to anything real. If Hood Network's mechanics firm up
  later, gold is the obvious hook point (e.g. redeemable for
  something), but that's a deliberate non-goal for v1.
- **No ambient "goblin just wanders by, catch him for a bonus" idle
  event.** Would be a nice addition once the core loop is validated —
  keeping v1 to steal → ransom → resolve only.
