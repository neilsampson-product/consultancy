/* Hero background motion (preview).
 *
 * ?bg=1 light moving across a surface, ?bg=2 ink drifting in water,
 * ?bg=3 defocused city lights. Each is drawn by a small WebGL shader in the
 * site's ink and blue, so there is no video file to load.
 *
 * It renders at a fraction of the screen's resolution (the textures are soft
 * anyway), caps itself at 30 frames a second, stops while the hero is off
 * screen or the tab is hidden, and draws a single still frame for anyone who
 * prefers reduced motion. Without WebGL nothing is added and the hero keeps
 * its gradient.
 */

const MODE = { light: 0, ink: 1, lights: 2 }[document.documentElement.getAttribute('data-hero-bg')];
const hero = document.querySelector('.hero--masthead');

function start() {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero__motion';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return;

  const program = build(gl, VERTEX, FRAGMENT);
  if (!program) return;

  hero.querySelector('.hero__ground').after(canvas);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);

  const uRes = gl.getUniformLocation(program, 'uRes');
  const uTime = gl.getUniformLocation(program, 'uTime');
  gl.uniform1i(gl.getUniformLocation(program, 'uMode'), MODE);

  /* The soft textures survive being drawn small and scaled up; the lights
     keep a little more detail so their edges read as out of focus, not blocky. */
  const scale = MODE === 2 ? 0.6 : 0.4;
  const resize = () => {
    const w = Math.max(1, Math.round(hero.clientWidth * scale));
    const h = Math.max(1, Math.round(hero.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
  };

  const draw = (seconds) => {
    resize();
    gl.uniform1f(uTime, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    draw(40);
    window.addEventListener('resize', () => draw(40), { passive: true });
    return;
  }

  /* Time only advances while playing, so pausing holds the frame and play
     picks up from the same place. */
  let playing = true;
  let visible = true;
  let elapsed = 40;
  let last = 0;
  let frame = 0;

  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    if (now - last < 33) return;
    const dt = last ? Math.min(now - last, 100) / 1000 : 0;
    last = now;
    elapsed += dt;
    draw(elapsed);
  };
  const run = () => {
    if (playing && visible && !document.hidden && !frame) { last = 0; frame = requestAnimationFrame(tick); }
  };
  const halt = () => { cancelAnimationFrame(frame); frame = 0; };

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'hero__motion-toggle';
  const label = () => {
    toggle.textContent = playing ? 'Pause motion' : 'Play motion';
    toggle.setAttribute('aria-pressed', String(!playing));
  };
  toggle.addEventListener('click', () => {
    playing = !playing;
    label();
    if (playing) run(); else halt();
  });
  label();
  hero.appendChild(toggle);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) run(); else halt();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else run(); });

  draw(elapsed);
  run();
}

function build(gl, vs, fs) {
  const compile = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const v = compile(gl.VERTEX_SHADER, vs);
  const f = compile(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const program = gl.createProgram();
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform int uMode;

const vec3 INK = vec3(0.075, 0.078, 0.090);
const vec3 BLUE = vec3(0.122, 0.310, 0.847);
const vec3 BLUE_LIGHT = vec3(0.561, 0.651, 1.0);
const vec3 WARM = vec3(0.95, 0.80, 0.62);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

/* Light moving across a surface: a soft diagonal beam sweeps slowly over a
   faintly textured wall, with a gentle ripple running through it. */
vec3 lightOnSurface(vec2 uv, float t) {
  vec2 p = uv;
  float surface = fbm(p * 4.0 + 3.0);
  float ripple = fbm(p * 2.2 + vec2(t * 0.018, -t * 0.012));
  float d = dot(p - vec2(0.9, 0.5), normalize(vec2(1.0, -0.55)));
  float sweep = sin(t * 0.045) * 0.55;
  float beam = exp(-pow((d - sweep) / 0.42, 2.0));
  float beam2 = exp(-pow((d - sweep + 0.75) / 0.22, 2.0)) * 0.45;
  float light = (beam + beam2) * (0.55 + 0.6 * ripple) * (0.8 + 0.35 * surface);
  return INK + light * mix(BLUE, BLUE_LIGHT, 0.45) * 0.58 + (surface - 0.5) * 0.02;
}

/* Ink drifting in water: noise folded through itself so the shapes curl and
   slowly unfurl, shading from ink into blue. */
vec3 inkInWater(vec2 uv, float t) {
  vec2 p = uv * 1.6;
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.020)), fbm(p + vec2(5.2, 1.3) - t * 0.015));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + t * 0.012),
                fbm(p + 3.5 * q + vec2(8.3, 2.8) - t * 0.010));
  float f = fbm(p + 3.5 * r);
  vec3 col = mix(INK, BLUE * 0.72, clamp(f * f * 2.1, 0.0, 1.0));
  col = mix(col, BLUE_LIGHT * 0.5, clamp(pow(length(r) * 0.62, 3.0), 0.0, 1.0) * 0.6);
  return col;
}

/* Defocused city lights: out-of-focus discs drift slowly sideways, mostly
   cool blue with a few warm points, each with the brighter rim of a lens. */
vec3 cityLights(vec2 uv, float t, float aspect) {
  vec3 col = INK;
  for (int i = 0; i < 30; i++) {
    float fi = float(i);
    float h1 = hash(vec2(fi, 1.7));
    float h2 = hash(vec2(fi, 8.3));
    float h3 = hash(vec2(fi, 4.1));
    float h4 = hash(vec2(fi, 6.9));
    float speed = 0.004 + 0.010 * h3;
    vec2 c = vec2(fract(h1 + t * speed) * 1.5 - 0.25, 0.08 + 0.84 * h2 + sin(t * 0.07 + fi) * 0.025);
    vec2 d = uv - c;
    d.x *= aspect;
    float radius = 0.035 + 0.11 * h4;
    float dist = length(d);
    float disc = 1.0 - smoothstep(radius * 0.82, radius, dist);
    float rim = smoothstep(radius * 0.55, radius * 0.95, dist) * disc;
    float pulse = 0.75 + 0.25 * sin(t * (0.2 + 0.3 * h1) + fi * 2.0);
    vec3 tint = h3 > 0.82 ? WARM : mix(BLUE, BLUE_LIGHT, h2);
    col += tint * (disc * 0.17 + rim * 0.11) * pulse * (0.45 + 0.55 * h1);
  }
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 st = vec2(uv.x * aspect, uv.y);
  vec3 col;
  if (uMode == 0) col = lightOnSurface(st, uTime);
  else if (uMode == 1) col = inkInWater(st, uTime);
  else col = cityLights(uv, uTime, aspect);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* Started last, once the shader sources above are defined. */
if (MODE !== undefined && hero) start();
