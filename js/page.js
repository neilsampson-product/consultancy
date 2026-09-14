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

/* ---- logo band ----------------------------------------------------------
 * The client marks range from 2.1:1 to 10.8:1. In equal-width grid cells a
 * shared height cap cannot hold: the wide wordmarks hit the cell's width first
 * and render up to half the height of the rest.
 *
 * Rather than shrink every logo to whatever the widest one allows — which
 * drops them to ~12px on a phone — a mark that cannot fit its cell at the cap
 * is given as many cells as it needs. The grid stays a grid, and every logo
 * keeps the same height.
 * ------------------------------------------------------------------------- */
const logoBand = document.querySelector('[data-logos]');
if (logoBand) {
  const logos = [...logoBand.querySelectorAll('img')];

  const fitLogos = () => {
    const styles = getComputedStyle(logoBand);
    const tracks = styles.gridTemplateColumns.split(' ').map(parseFloat).filter((n) => n > 0.5);
    const measured = logos.filter((img) => img.naturalWidth && img.naturalHeight);
    if (!tracks.length || !measured.length) return;

    const cell = tracks[0];
    const gap = parseFloat(styles.columnGap) || 0;
    // mirrors the stylesheet's clamp(22px, 2.4vw, 32px) ceiling
    const height = Math.min(32, Math.max(22, window.innerWidth * 0.024));

    logos.forEach((img) => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const needed = (img.naturalWidth / img.naturalHeight) * height;
      let span = 1;
      while (span < tracks.length && span * cell + (span - 1) * gap < needed) span++;
      img.parentElement.style.gridColumn = span > 1 ? `span ${span}` : '';
    });

    logoBand.style.setProperty('--logo-h', `${height}px`);
  };

  fitLogos();
  logos.forEach((img) => {
    if (!img.complete) img.addEventListener('load', fitLogos, { once: true });
  });
  window.addEventListener('resize', fitLogos, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(fitLogos).observe(logoBand);
}

/* ---- motion -------------------------------------------------------------- */
init(document.body, {
  stepDim: 0.3,
  onNav: (el, scrolled) => el.classList.toggle('is-scrolled', scrolled)
});
