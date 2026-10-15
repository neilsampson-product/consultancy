/* Hero film.
 *
 * Six slow clips play behind the headline, balanced across the proposition:
 * fitness (a runner on a misty ridge, a runner refuelling, a swimmer), health
 * (fresh food being prepared, a watch on the wrist) and wellbeing (stillness
 * above the clouds). Each holds for SHOT seconds and crossfades into the next
 * with a slow push-in.
 *
 * Two <video> elements take turns: while one shows, the other loads the next
 * clip, so only one ~1.5 MB file is ever in flight.
 *
 * The poster still stays on its own for anyone who prefers reduced motion or
 * has asked to save data, and if the browser refuses to autoplay. Playback
 * stops while the hero is off screen or the tab is hidden.
 *
 * All clips are Pexels videos (free licence, no attribution required), by id:
 * 01 35274206, 02 5310938, 03 4252283, 04 8685997, 05 40241098, 06 7038138.
 * Each is a 6.2 s cut at 1280x720, ~1.9 Mbps, no audio.
 */

const film = document.querySelector('[data-hero-film]');

const CLIPS = ['01-ridge', '02-refuel', '03-food', '04-swim', '05-watch', '06-clouds']
  .map((name) => `assets/video/hero/${name}.mp4`);

/* Seconds each clip holds before the next starts fading in, and the fade
   itself, which matches the opacity transition in the CSS. A clip runs
   SHOT + FADE seconds, so it is still moving as it fades out. */
const SHOT = 4.8;
const FADE = 1.4;

function start() {
  const players = [0, 1].map(() => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    film.append(v);
    return v;
  });

  const load = (player, i) => {
    const url = CLIPS[i % CLIPS.length];
    if (player.dataset.clip === url) return;
    player.dataset.clip = url;
    player.src = url;
    player.load();
  };

  let index = 0;
  let current = players[0];
  let timer = 0;
  let visible = true;
  let started = false;
  let pending = false;
  let refused = false;

  const show = (i) => {
    index = i % CLIPS.length;
    const previous = current;
    current = players.find((p) => p !== previous);
    current.currentTime = 0;
    current.play().catch(() => {});
    current.classList.add('is-on');
    previous.classList.remove('is-on');

    // Once the outgoing clip has faded, its player loads the one after this.
    setTimeout(() => {
      previous.pause();
      load(previous, index + 1);
    }, FADE * 1000 + 100);

    clearTimeout(timer);
    timer = setTimeout(() => show(index + 1), SHOT * 1000);
  };

  const begin = () => {
    // A play() that hasn't settled yet (a background tab) is left to finish.
    if (pending) return;
    pending = true;
    current.play().then(() => {
      started = true;
      current.classList.add('is-on');
      clearTimeout(timer);
      timer = setTimeout(() => show(index + 1), SHOT * 1000);
    }).catch((err) => {
      pending = false;
      // Autoplay refused outright (Low Power Mode, for one): keep the poster.
      // Anything else tries again when the hero is next in view.
      if (err.name !== 'NotAllowedError') return;
      refused = true;
      players.forEach((p) => p.remove());
    });
  };

  const run = () => {
    if (refused || !visible || document.hidden) return;
    if (!started) { begin(); return; }
    current.play().catch(() => {});
    clearTimeout(timer);
    timer = setTimeout(() => show(index + 1), SHOT * 1000);
  };
  const halt = () => {
    clearTimeout(timer);
    current.pause();
  };

  load(players[0], 0);
  load(players[1], 1);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) run(); else halt();
  }).observe(film);
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else run(); });
  run();
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection && navigator.connection.saveData;
if (film && !reduced && !saveData) start();
