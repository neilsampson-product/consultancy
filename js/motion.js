/* Scroll and reveal motion for neilsampson.net
 *
 * Reveals: data-reveal="up|mask|line" with optional data-delay (ms) and
 * data-stagger (ms per word). Images: data-imgreveal="up|center".
 * Scroll-driven: progress bar, nav state, parallax, pinned steps.
 *
 * The one rule that shapes this file: content held at a transition's start
 * value is invisible, so a failed animation must degrade to VISIBLE content,
 * never to hidden content. Three things enforce that:
 *
 *   1. Nothing is hidden until the animation clock has been proven to run.
 *      If rAF never fires, no element is ever hidden in the first place.
 *   2. Each element arms a timer that writes its end state plainly if the
 *      transition has not progressed by the time it should have finished.
 *   3. A final sweep shows anything still hidden after 8s, whatever the cause.
 *
 * End values are written synchronously after a forced reflow rather than
 * inside requestAnimationFrame, so a throttled or background tab still lands
 * on the end state.
 */

const EASE = 'cubic-bezier(.16, 1, .3, 1)';
const SAFETY_MS = 8000;

export function init(root, opts = {}) {
  if (!root) return () => {};

  const amp = opts.amp == null ? 1 : opts.amp;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups = [];

  wireArrows(root);

  if (amp <= 0 || reduced) {
    showEverything(root);
    wireNavOnly(root, opts, cleanups);
    return () => cleanups.forEach(safely);
  }

  /* Probe the animation clock before hiding anything. */
  clockRuns().then((ok) => {
    if (!ok) {
      showEverything(root);
      wireNavOnly(root, opts, cleanups);
      return;
    }
    cleanups.push(wireReveals(root, amp));
    cleanups.push(wireScroll(root, amp, opts));

    const safety = setTimeout(() => showEverything(root), SAFETY_MS);
    cleanups.push(() => clearTimeout(safety));
  });

  return () => cleanups.forEach(safely);
}

const safely = (fn) => { try { fn(); } catch (e) { /* teardown is best-effort */ } };

/* Resolves false if two animation frames don't arrive within 250ms. */
function clockRuns() {
  return new Promise((resolve) => {
    let done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => settle(false), 250);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(timer);
      settle(true);
    }));
  });
}

/* ---- the visible end state ----------------------------------------------- */

function showEverything(root) {
  root.querySelectorAll('[data-reveal]').forEach(showReveal);
  root.querySelectorAll('[data-imgreveal]').forEach(showImg);
  root.querySelectorAll('[data-step]').forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.classList.add('is-on');
  });
  const rail = root.querySelector('[data-steprail-fill]');
  if (rail) rail.style.transform = 'scaleX(1)';
}

function showReveal(el) {
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.style.transform = 'none';
  if (el._words) el._words.forEach((w) => { w.style.transition = 'none'; w.style.transform = 'none'; });
}

function showImg(frame) {
  frame.style.transition = 'none';
  frame.style.clipPath = 'none';
  const inner = frame.querySelector('img');
  if (inner) { inner.style.transition = 'none'; inner.style.transform = 'none'; }
}

/* The nav still changes state when motion is off: it carries legibility, not
   decoration — paper type over the ink hero, ink type over the chalk below. */
function wireNavOnly(root, opts, cleanups) {
  const nav = root.querySelector('[data-nav]');
  if (!nav || !opts.onNav) return;
  const onScroll = () => opts.onNav(nav, window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));
  onScroll();
}

/* ---- reveals ------------------------------------------------------------- */

function wireReveals(root, amp) {
  const els = [...root.querySelectorAll('[data-reveal]')];
  const imgs = [...root.querySelectorAll('[data-imgreveal]')];

  els.forEach((el) => {
    const kind = el.dataset.reveal;
    if (kind === 'mask') {
      el.style.display = 'inline-block';
      el._words = splitWords(el);
      el._words.forEach((w) => { w.style.transform = 'translateY(108%)'; });
    } else if (kind === 'line') {
      el.style.transform = 'scaleX(0)';
    } else {
      el.style.opacity = '0';
      el.style.transform = `translateY(${Math.round(30 * amp)}px)`;
    }
  });

  imgs.forEach((frame) => {
    const dir = frame.dataset.imgreveal || 'up';
    frame.style.clipPath = dir === 'center' ? 'inset(50% 0 50% 0)' : 'inset(0 0 100% 0)';
    const inner = frame.querySelector('img');
    if (inner) {
      inner.style.transform = `scale(${1 + 0.06 * amp})`;
      inner.style.willChange = 'transform';
    }
  });

  const timers = [];

  /* Install the transition, force a reflow so it is definitely live, then
     write the end value synchronously. */
  const play = (el, transition, write) => {
    el.style.transition = transition;
    void el.offsetWidth;
    write();
  };

  const reveal = (el) => {
    const delay = Number(el.dataset.delay || 0) * amp;
    const kind = el.dataset.reveal;

    if (kind === 'mask') {
      const stagger = Number(el.dataset.stagger || 52) * amp;
      el._words.forEach((word, i) => {
        play(word, `transform 1s ${EASE} ${delay + i * stagger}ms`, () => {
          word.style.transform = 'none';
        });
      });
      timers.push(setTimeout(() => showReveal(el), delay + el._words.length * stagger + 1400));
      return;
    }

    const transition = kind === 'line'
      ? `transform 1.2s ${EASE} ${delay}ms`
      : `opacity .9s ${EASE} ${delay}ms, transform 1.1s ${EASE} ${delay}ms`;

    play(el, transition, () => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });

    // If the transition never progressed, write the end state plainly.
    timers.push(setTimeout(() => {
      if (kind !== 'line' && parseFloat(getComputedStyle(el).opacity) < 1) showReveal(el);
    }, delay + 1500));
  };

  /* Clip and inner scale run to different durations on purpose: the frame
     finishes opening while the picture is still settling. */
  const revealImg = (frame) => {
    const delay = Number(frame.dataset.delay || 0) * amp;
    const inner = frame.querySelector('img');

    play(frame, `clip-path 1.25s ${EASE} ${delay}ms`, () => {
      frame.style.clipPath = 'inset(0 0 0 0)';
    });
    if (inner) {
      play(inner, `transform 1.7s ${EASE} ${delay}ms`, () => { inner.style.transform = 'none'; });
    }

    timers.push(setTimeout(() => {
      const cp = getComputedStyle(frame).clipPath;
      if (cp && cp !== 'none' && cp.includes('%')) showImg(frame);
    }, delay + 2000));
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      observer.unobserve(el);
      if (el.hasAttribute('data-imgreveal')) revealImg(el);
      else reveal(el);
    });
  }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });

  [...els, ...imgs].forEach((el) => observer.observe(el));

  return () => {
    observer.disconnect();
    timers.forEach(clearTimeout);
  };
}

/* ---- scroll-driven ------------------------------------------------------- */

function wireScroll(root, amp, opts) {
  const bar = root.querySelector('[data-progress]');
  const nav = root.querySelector('[data-nav]');
  const pin = root.querySelector('[data-pin]');
  const steps = pin ? [...pin.querySelectorAll('[data-step]')] : [];
  const railFill = root.querySelector('[data-steprail-fill]');
  const parallax = [...root.querySelectorAll('[data-parallax]')];
  const quote = root.querySelector('[data-quote]');

  const dim = opts.stepDim == null ? 0.3 : opts.stepDim;
  steps.forEach((step) => {
    step.style.opacity = String(dim);
    step.style.transform = `translateY(${10 * amp}px)`;
    step.style.transition = `opacity .55s ease, transform .55s ${EASE}`;
    step.classList.remove('is-on');
  });

  const setStep = (step, on) => {
    step.style.opacity = on ? '1' : String(dim);
    step.style.transform = on ? 'none' : `translateY(${10 * amp}px)`;
    step.classList.toggle('is-on', on);
  };
  if (railFill) railFill.style.transition = 'transform .3s linear';

  let words = null;
  if (quote) {
    words = splitWords(quote);
    words.forEach((w) => {
      w.style.opacity = '0.18';
      w.style.transition = 'opacity .45s ease';
    });
  }

  let queued = false;

  const frame = () => {
    queued = false;
    const y = window.scrollY || 0;
    const vh = window.innerHeight;

    if (bar) {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - vh);
      bar.style.transform = `scaleX(${Math.min(1, y / scrollable)})`;
    }

    if (nav && opts.onNav) opts.onNav(nav, y > 40);

    parallax.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const rel = (r.top + r.height / 2 - vh / 2) / vh;
      const shift = -rel * Number(el.dataset.parallax) * amp * 100;
      el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    });

    /* The pinned section is sticky for its own height plus its runway, and its
       steps light in sequence as progress through it passes each threshold.
       When page.js has unpinned it for being taller than the screen, progress
       through the section no longer tracks what is on screen, so each step
       lights as it scrolls into view instead. */
    if (pin && steps.length) {
      const r = pin.getBoundingClientRect();
      const pinned = !pin.classList.contains('pin--static');
      const p = clamp(-r.top / Math.max(1, r.height - vh));
      steps.forEach((step, i) => {
        const on = pinned
          ? p >= (i * 0.9) / steps.length
          : step.getBoundingClientRect().top < vh * 0.72;
        setStep(step, on);
      });
      if (railFill) railFill.style.transform = `scaleX(${p.toFixed(3)})`;
    }

    if (words && quote) {
      const r = quote.getBoundingClientRect();
      const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3));
      const lit = Math.round(p * words.length * 1.25);
      words.forEach((w, i) => { w.style.opacity = i < lit ? '1' : '0.18'; });
    }
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

const clamp = (n) => Math.min(1, Math.max(0, n));

/* ---- helpers ------------------------------------------------------------- */

function wireArrows(root) {
  root.querySelectorAll('a').forEach((a) => {
    const arrow = a.querySelector('[data-arrow]');
    if (!arrow) return;
    const diagonal = arrow.textContent.trim() === '↗';
    arrow.style.display = 'inline-block';
    arrow.style.transition = 'transform .35s cubic-bezier(.2,.7,.15,1)';
    a.addEventListener('mouseenter', () => {
      arrow.style.transform = diagonal ? 'translate(4px, -4px)' : 'translateX(6px)';
    });
    a.addEventListener('mouseleave', () => { arrow.style.transform = 'none'; });
  });
}

/* Wraps each word in an overflow:hidden clip so it can slide up from below.
   The padding/negative-margin pair keeps the clip off the descenders. */
function splitWords(el) {
  if (el._split) return el._split;
  const out = [];

  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((token) => {
          if (!token) return;
          if (/^\s+$/.test(token)) {
            frag.appendChild(document.createTextNode(token));
            return;
          }
          const clip = document.createElement('span');
          clip.className = 'word-clip';
          const inner = document.createElement('span');
          inner.className = 'word';
          inner.textContent = token;
          clip.appendChild(inner);
          frag.appendChild(clip);
          out.push(inner);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        walk(n);
      }
    });
  };

  walk(el);
  el._split = out;
  return out;
}
