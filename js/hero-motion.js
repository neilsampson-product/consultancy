/* Hero background motion.
 *
 * A layered blue form breathes and wobbles slowly on the right of the hero,
 * its rings drifting apart and back together over a faintly textured wall,
 * with a soft beam sweeping past behind it. It is drawn by a small WebGL
 * shader in the site's ink and blue, so there is no video file.
 *
 * It renders at a fraction of the screen's resolution (the textures are soft
 * anyway), caps itself at 30 frames a second, stops while the hero is off
 * screen or the tab is hidden, and draws a single still frame for anyone who
 * prefers reduced motion. Without WebGL nothing is added and the hero keeps
 * its gradient.
 */

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

  /* The texture is soft, so it survives being drawn small and scaled up. */
  const scale = 0.4;
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

  /* Time only advances while drawing, so the texture picks up where it left
     off when the hero scrolls back into view or the tab returns. */
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
    if (visible && !document.hidden && !frame) { last = 0; frame = requestAnimationFrame(tick); }
  };
  const halt = () => { cancelAnimationFrame(frame); frame = 0; };

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

const vec3 INK = vec3(0.075, 0.078, 0.090);
const vec3 BLUE = vec3(0.122, 0.310, 0.847);
const vec3 BLUE_LIGHT = vec3(0.561, 0.651, 1.0);

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

/* A layered form, like foam: five rings stacked from the outside in, each
   warped by its own slow noise and a pair of turning lobes, so the outline
   wobbles and the layers drift apart and back together. Each layer adds a
   little light, and a fine line traces every edge so the rings read. */
vec2 foam(vec2 st, vec2 centre, float t) {
  vec2 q = st - centre;
  float r = length(q);
  float a = atan(q.y, q.x);
  float lobes = 0.07 * sin(3.0 * a + t * 0.11) + 0.04 * sin(5.0 * a - t * 0.08);
  float fill = 0.0;
  float line = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float warp = fbm(q * 1.4 + vec2(fi * 1.7 + t * 0.045, -fi * 1.3 - t * 0.035)) - 0.5;
    float radius = (0.5 - fi * 0.08) * (1.0 + 0.05 * sin(t * 0.21 + fi * 1.3));
    float edge = r * (1.0 + lobes * (0.6 + fi * 0.15)) + warp * 0.14;
    fill += smoothstep(radius + 0.012, radius - 0.012, edge);
    line += smoothstep(0.009, 0.0, abs(edge - radius)) * (0.5 + fi * 0.12);
  }
  return vec2(fill / 5.0, line);
}


void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 st = vec2(uv.x * aspect, uv.y);
  vec3 col = lightOnSurface(st, uTime);

  /* On a wide screen the form sits right of the headline; on a tall one it
     moves up and in, behind the top of the hero. */
  vec2 centre = aspect > 1.0 ? vec2(aspect * 0.74, 0.56) : vec2(aspect * 0.62, 0.66);
  vec2 f = foam(st, centre, uTime);
  col += f.x * mix(BLUE, BLUE_LIGHT, f.x) * 0.16 + f.y * BLUE_LIGHT * 0.07;

  gl_FragColor = vec4(col, 1.0);
}
`;

/* Started last, once the shader sources above are defined. */
if (hero) start();
