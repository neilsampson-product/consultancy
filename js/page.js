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

/* ---- pinned module ------------------------------------------------------
 * The capability module pins while its offers step in. That only works if it
 * fits on screen beneath the nav: pinned any taller, its lower half would sit
 * out of view for the whole pin. So it is measured, not assumed — it pins on
 * laptops and desktops, and scrolls normally where it does not fit.
 * ------------------------------------------------------------------------- */
const pinModule = document.querySelector('[data-pin]');
if (pinModule) {
  const pinContent = pinModule.querySelector('.pin__inner');

  const fitPin = () => {
    const room = window.innerHeight - (nav ? nav.offsetHeight : 0);
    pinModule.classList.toggle('pin--static', pinContent.getBoundingClientRect().height > room);
  };

  fitPin();
  window.addEventListener('resize', fitPin, { passive: true });
  window.addEventListener('load', fitPin);
  if (document.fonts) document.fonts.ready.then(fitPin).catch(() => {});
  if (window.ResizeObserver) new ResizeObserver(fitPin).observe(pinContent);
}

/* ---- hero portrait (concept preview) ------------------------------------
 * On a phone the portrait sits in the space above the hero text, and how much
 * space there is depends on how far that text wraps. So it is measured: the
 * portrait is sized to the room between the nav and the first line, and
 * dropped where there is too little for a face to read.
 * ------------------------------------------------------------------------- */
const heroSection = document.querySelector('section[data-hero]');
const heroText = heroSection && heroSection.querySelector('.hero__inner');
if (heroSection && heroText && document.documentElement.hasAttribute('data-hero-concept')) {
  const fitPortrait = () => {
    const navHeight = nav ? nav.offsetHeight : 0;
    const textOffset = heroText.getBoundingClientRect().top - heroSection.getBoundingClientRect().top;
    const room = Math.round(textOffset - navHeight - 12);
    heroSection.style.setProperty('--portrait-room', `${Math.max(0, room)}px`);
    heroSection.classList.toggle('hero--portrait-cramped', room < 140);
  };

  fitPortrait();
  window.addEventListener('resize', fitPortrait, { passive: true });
  window.addEventListener('load', fitPortrait);
  if (document.fonts) document.fonts.ready.then(fitPortrait).catch(() => {});
  if (window.ResizeObserver) new ResizeObserver(fitPortrait).observe(heroText);
}

/* ---- motion -------------------------------------------------------------- */
init(document.body, {
  stepDim: 0.3,
  onNav: (el, scrolled) => el.classList.toggle('is-scrolled', scrolled)
});
