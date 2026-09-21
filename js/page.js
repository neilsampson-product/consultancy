/* Per-page wiring shared by every page: hero video, the nav height the hero
   is laid out against, the phone menu, the scroll cue, and the motion module.
   Every piece is optional — a page without a hero video or a cue simply skips
   that block. */

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

/* ---- phone menu ----------------------------------------------------------
 * Below 640px the nav links fold into a panel behind a menu button. It closes
 * when a link is chosen (most jump within the page), on Escape, and if the
 * window widens past the breakpoint, so the desktop nav never opens stuck.
 * ------------------------------------------------------------------------- */
const navToggle = nav && nav.querySelector('[data-navtoggle]');
if (navToggle) {
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  };

  navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.querySelectorAll('.nav__link').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      navToggle.focus();
    }
  });
  window.matchMedia('(max-width: 640px)').addEventListener('change', (e) => {
    if (!e.matches) setMenu(false);
  });
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
