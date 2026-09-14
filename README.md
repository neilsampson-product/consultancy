# neil-sampson.com

Static site — plain HTML, one shared stylesheet, two ES modules. No build step,
no dependencies, no framework. Any static host will serve it as-is.

## Run it

```bash
python3 serve.py
```

Then open http://localhost:4321. Pass a port to use a different one.

## Layout

```
index.html            Home
services.html         Services
case-lindblad.html    Case study
case-bpp.html         Case study
case-polesdon.html    Case study

css/site.css          Every token and component. Read the token block first.
js/motion.js          Reveals, scroll-driven behaviour, hover wiring.
js/page.js            Per-page wiring: hero video, nav measurement, scroll cue.

assets/               Images, logos, video, favicons
fonts/                Everett (Light, Medium)
```

## How it holds together

**Tokens.** Colour, type, spacing, radii and easing are custom properties at the
top of `css/site.css`. Nothing below that block hard-codes a colour.

**No breakpoints.** Type is `clamp()`, grids are
`repeat(auto-fit, minmax(min(100%, Npx), 1fr))`, so columns collapse on their
own. The single media query in the file handles the nav below 640px, which the
design did not cover.

**The hero.** `height: 100svh` — `svh` so mobile browser chrome cannot push
content below the fold. It runs under the transparent nav, which is sticky and
therefore holds its own space in flow, so the hero is pulled back up by exactly
the nav's measured height. `js/page.js` writes that height to `--nav-h` at
runtime; every hard-coded value drifts as the type loads.

**Motion degrades to visible.** Content held at a transition's start value is
invisible, so `js/motion.js` never hides anything until it has proven the
animation clock runs, arms a per-element timer that writes the end state if a
transition fails to progress, and sweeps anything still hidden after 8s. With
JavaScript disabled the markup is fully visible, because hiding is what the
script does, not the markup.

**Reduced motion.** `prefers-reduced-motion: reduce` shows everything at once,
stops the scroll cue, and pauses the Polesdon product film (handing it controls
instead). The nav still changes state on scroll — that is legibility, not
decoration.

## Typeface

The design calls for Everett (Weltkern). Two weights are self-hosted: Light
covers 300–400 and Medium covers 500–700, so the 600 micro-labels and the 700
wordmark resolve to Medium rather than to a synthesised bold. Space Grotesk —
what the design was drawn in — loads from Google Fonts as the fallback.

**Check the licence covers web use before this goes live.**

## Known gaps

- There is no hero video. The chosen homepage design dropped it in favour of
  the lit gradient ground; only `Home - Alt`, the variant kept for comparison,
  still uses one. `hero.mp4` is not in this repo — it is in the handoff bundle.
  If the video hero ever comes back, the source needs re-cutting first: it is
  3448×1940 with a video player's UI burned into the footage, well past the 2s
  the handoff claims.
- `assets/images/polesdon/polesdon-edit.mp4` is 16MB and loads on the Polesdon
  case study. It wants re-encoding, a poster frame, and `preload="none"`.
- Images are unoptimised originals. No `srcset`, no AVIF/WebP. `bpp-lion.jpg`
  is 560×489, small for a band that renders up to 560px tall.
- The favicon "N" is set in Helvetica — re-export it from the real letterform.
- "Who I work with" on the home page carries a placeholder label in the design.
- The FCA work band has no case study behind it and does not link anywhere.
