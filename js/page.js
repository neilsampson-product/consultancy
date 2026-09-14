/* Per-page wiring shared by every page: hero video, the nav height the hero
   is laid out against, the scroll cue, and the motion module. Every piece is
   optional — a page without a hero video or a cue simply skips that block. */

import { init } from './motion.js';

const nav = document.querySelector('[data-nav]');

/* ---- inline film --------------------------------------------------------
 * The Polesdon case study carries an autoplaying product film. An autoplaying
 * loop is motion, so it stops for anyone who has asked for less of it.
 * ------------------------------------------------------------------------- */
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('video[autoplay]').forEach((film) => {
    film.pause();
    film.removeAttribute('autoplay');
    film.controls = true;
  });
}

/* ---- nav height ---------------------------------------------------------
 * The hero runs under the transparent nav, which is sticky and so holds its
 * own space in flow: the hero is pulled back up by exactly the nav's height
 * and takes symmetric padding of that height plus 28px, so its content sits
 * optically centred. Measured, not hard-coded — the value moves as the type
 * loads and as the nav wraps at narrow widths.
 *
 * Height itself stays in CSS as 100svh. The design's prototype wrote
 * window.innerHeight here, but that reintroduces exactly the mobile
 * browser-chrome jump svh exists to avoid.
 * ------------------------------------------------------------------------- */
if (nav) {
  let tries = 0;

  const fit = () => {
    const navHeight = Math.round(nav.offsetHeight);
    // Never write a zero: it would replace the stylesheet's fallback with nothing.
    if (!navHeight) {
      if (tries++ < 120) requestAnimationFrame(fit);
      return;
    }
    document.documentElement.style.setProperty('--nav-h', `${navHeight}px`);
  };

  fit();
  window.addEventListener('resize', fit, { passive: true });
  window.addEventListener('load', fit);
  if (document.fonts) document.fonts.ready.then(fit).catch(() => {});
  if (window.ResizeObserver) new ResizeObserver(fit).observe(nav);
}

/* ---- scroll cue ---------------------------------------------------------- */
const cue = document.querySelector('[data-scrollcue]');
if (cue) {
  requestAnimationFrame(() => cue.classList.add('is-in'));
  window.addEventListener('scroll', () => {
    cue.classList.toggle('is-past', window.scrollY > 80);
  }, { passive: true });
}

/* ---- motion -------------------------------------------------------------- */
init(document.body, {
  stepDim: 0.3,
  onNav: (el, scrolled) => el.classList.toggle('is-scrolled', scrolled)
});
