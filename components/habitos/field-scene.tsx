"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

/*
 * The Hábitos ground: a lavender field at the blue hour, a lone figure on
 * the hill, and above the horizon a slow vortex of cloud, like time turning.
 *
 * Layers, back to front, each lagging the scroll by its distance (parallax)
 * and sliding under the pointer by its depth:
 *
 *   sky     a fragment shader: the blue-hour gradient, high cloud, the
 *           flattened log-spiral vortex and the sea of cloud under it.
 *   mist    soft bands drifting along the horizon.
 *   back    the far field (canvas): thousands of small lavender spikes over
 *           the hill, the figure and two rocks standing on its ridge.
 *   front   the near field (canvas): big spikes, out of focus, and petals.
 *
 * The flowers are alive: they sway, gusts roll across the field in waves,
 * they lean away from the pointer, and they open as today's habits are kept
 * (`bloom`, 0..1: buds at none, full lilac when all are kept). Keeping a
 * habit sends a gust from where it was pressed (the "lav:gust" window event,
 * detail { x: 0..1 }), which also lifts petals into the air.
 *
 * Canvases run only while on screen and while the tab is visible. With
 * reduced motion everything is drawn once, still.
 */

/* ---------- ridges, as a share of the scene's height ---------- */

const bump = (x: number, at: number, width: number) => Math.exp(-(((x - at) / width) ** 2));

/* The far hill: high on the left, a small rise in the middle for the figure. */
export const backRidge = (x: number) =>
  0.575 - 0.075 * bump(x, 0.1, 0.24) - 0.03 * bump(x, 0.5, 0.06) - 0.045 * bump(x, 0.86, 0.13) + 0.006 * Math.sin(x * 29);

/* The near hill: a mound rising at the lower left, as if we stood on it. */
const frontRidge = (x: number) => 0.73 - 0.09 * bump(x, 0.18, 0.3) + 0.02 * Math.sin(x * 5 + 1.4) + 0.008 * Math.sin(x * 21);

/* ---------- sky ---------- */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uLook;
uniform float uBloom;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y) + uLook * 0.025;
  float h = uv.y;

  vec3 top = vec3(0.08, 0.10, 0.21);
  vec3 mid = vec3(0.27, 0.30, 0.50);
  vec3 hor = vec3(0.60, 0.60, 0.79) + uBloom * vec3(0.05, 0.03, 0.04);
  vec3 col = mix(hor, mid, smoothstep(0.44, 0.72, h));
  col = mix(col, top, smoothstep(0.7, 1.0, h));

  // High, thin cloud.
  float cl = fbm(vec2(p.x * 1.3 + uTime * 0.006, p.y * 4.2));
  col = mix(col, col * 1.2 + 0.03, smoothstep(0.5, 0.85, cl) * smoothstep(0.6, 0.92, h) * 0.45);

  // The vortex: a log spiral on a plane near the horizon, seen low (flattened).
  vec2 q = p - vec2(0.6 * asp, 0.64);
  q.y *= 3.4;
  float r = length(q);
  float a = atan(q.y, q.x);
  float lr = log(r + 0.0001);
  float warp = fbm(vec2(a * 2.0, lr * 3.0 - uTime * 0.02)) * 1.6;
  float ph = a - lr * 2.2 + uTime * 0.045;
  float arms = pow(0.5 + 0.5 * sin(ph * 2.0 + warp), 3.0);
  float fil = pow(0.5 + 0.5 * sin(ph * 23.0 + warp * 6.0), 6.0);
  float env = smoothstep(1.4, 0.15, r) * smoothstep(0.02, 0.2, r);
  float streak = (arms * 0.5 + fil * arms * 0.95) * env * smoothstep(0.95, 0.62, h);
  col += vec3(0.86, 0.86, 1.0) * streak * 0.55;
  col += vec3(0.78, 0.74, 0.98) * exp(-r * 5.0) * 0.3;

  // The sea of cloud under it, and the haze on the horizon.
  float sea = smoothstep(0.55, 0.32, h);
  float seaN = fbm(vec2(p.x * 3.0 + uTime * 0.01, p.y * 12.0));
  col = mix(col, vec3(0.52, 0.53, 0.72) + seaN * 0.12, sea * 0.6);
  col = mix(col, hor * 1.05, exp(-abs(h - 0.52) * 14.0) * 0.35);

  // A few stars up high.
  vec2 sg = floor(gl_FragCoord.xy / 2.0);
  float st = step(0.997, hash(sg)) * smoothstep(0.66, 0.96, h) * (0.55 + 0.45 * sin(uTime * 1.7 + hash(sg + 1.0) * 30.0));
  col += st * 0.55;

  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

function Sky({ bloom, still }: { bloom: number; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef(bloom);
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    bloomRef.current = bloom;
    if (still) redraw.current();
  }, [bloom, still]);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uLook = gl.getUniformLocation(prog, "uLook");
    const uBloom = gl.getUniformLocation(prog, "uBloom");

    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    let bloomNow = bloomRef.current;
    let raf = 0;
    let visible = true;
    const t0 = performance.now() - 60_000;

    const draw = (now: number) => {
      look.x += (look.tx - look.x) * 0.04;
      look.y += (look.ty - look.y) * 0.04;
      bloomNow += (bloomRef.current - bloomNow) * (still ? 1 : 0.03);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform2f(uLook, look.x, look.y);
      gl.uniform1f(uBloom, bloomNow);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    redraw.current = () => draw(t0 + 60_000);

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (still) redraw.current();
    };
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      if (!still && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      look.tx = e.clientX / window.innerWidth - 0.5;
      look.ty = 0.5 - e.clientY / window.innerHeight;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });

    resize();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", sync);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [still]);

  return <canvas ref={ref} className="lav-canvas" />;
}

/* ---------- flowers ---------- */

/* A tiny seeded PRNG, so the field keeps its shape. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Flower = { x: number; y: number; h: number; phase: number; tone: number; lean: number };
type Petal = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; size: number };
type Gust = { start: number; x: number; strength: number };

type FieldOptions = {
  seed: number;
  ridge: (x: number) => number;
  /** Bottom of the planted area, as a share of the height */
  floor: number;
  /** Flowers per 1000 CSS px² of planted area */
  density: number;
  /** Spike height range in px at a 900px-tall scene, far to near */
  size: [number, number];
  /** Hill colours, ridge to floor */
  ground: [string, string];
  stem: string;
  /** Spike thickness as a share of its height */
  spike: number;
  maxDpr: number;
  petals?: boolean;
};

/* Spike colours: buds (dusky violet) to full bloom (lilac), four tones each. */
const BUD = [
  [128, 110, 190],
  [112, 96, 176],
  [144, 126, 202],
  [100, 88, 162],
];
const OPEN = [
  [198, 178, 255],
  [172, 148, 244],
  [222, 208, 255],
  [154, 128, 232],
];

function useFlowerField(ref: React.RefObject<HTMLCanvasElement | null>, opts: FieldOptions, bloom: number, still: boolean) {
  const bloomRef = useRef(bloom);
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    bloomRef.current = bloom;
    if (still) redraw.current();
  }, [bloom, still]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const o = opts;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let flowers: Flower[] = [];
    let bands: Flower[][] = [];
    const petals: Petal[] = [];
    const gusts: Gust[] = [];
    const pointer = { x: -9999, y: -9999 };
    let bloomNow = bloomRef.current;
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let spawn = 0;

    const plant = () => {
      const r = rng(o.seed);
      const scale = H / 900;
      const area = W * H * (o.floor - 0.55);
      // Narrow screens get a denser field, or it reads as bare ground.
      const narrow = W < 700 ? 1.9 : 1;
      const count = Math.min(4200, Math.round((area / 1000) * o.density * narrow));
      flowers = [];
      for (let i = 0; i < count; i++) {
        const xf = r();
        const top = o.ridge(xf);
        // More of them packed near the ridge, where they are far away.
        const d = Math.pow(r(), 1.6);
        const yf = top + d * (o.floor - top);
        flowers.push({
          x: xf * W,
          y: yf * H + 2,
          h: (o.size[0] + (o.size[1] - o.size[0]) * d) * scale * (0.75 + r() * 0.5),
          phase: r() * Math.PI * 2,
          tone: Math.floor(r() * 4),
          lean: (r() - 0.5) * 0.25,
        });
      }
      flowers.sort((a, b) => a.y - b.y);
      bands = [];
      for (let i = 0; i < flowers.length; i += 220) bands.push(flowers.slice(i, i + 220));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      plant();
      if (still) redraw.current();
    };

    const hill = () => {
      const g = ctx.createLinearGradient(0, H * 0.45, 0, H * o.floor);
      g.addColorStop(0, o.ground[0]);
      g.addColorStop(1, o.ground[1]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, o.ridge(x / W) * H);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };

    const draw = (now: number) => {
      const t = now / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      bloomNow += (bloomRef.current - bloomNow) * (still ? 1 : 0.025);

      // The pointer, in this canvas's own (moving) coordinates.
      const rect = canvas.getBoundingClientRect();
      const px = pointer.x - rect.left;
      const py = pointer.y - rect.top;
      const reach = 110 * (H / 900) + 40;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      hill();

      for (let i = gusts.length - 1; i >= 0; i--) if (t - gusts[i].start > 4) gusts.splice(i, 1);

      const colors = OPEN.map((c, i) => {
        const b = BUD[i];
        const m = (k: number) => Math.round(b[k] + (c[k] - b[k]) * bloomNow);
        return `rgb(${m(0)} ${m(1)} ${m(2)})`;
      });
      const radius = 0.55 + 0.5 * bloomNow;

      ctx.lineCap = "round";
      for (const band of bands) {
        const tips: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        let sizeSum = 0;
        ctx.beginPath();
        for (const f of band) {
          const xr = f.x / W;
          // A slow wave of wind always rolling across, plus the gusts.
          const wave = 0.5 + 0.5 * Math.sin(t * 0.55 - xr * 7 + f.y * 0.004);
          let lean = f.lean - 0.02 + wave * 0.12;
          for (const g of gusts) {
            const front = g.x + (t - g.start) * 0.42;
            const hit = Math.exp(-(((xr - front) / 0.09) ** 2)) * g.strength * Math.max(0, 1 - (t - g.start) / 4);
            lean += hit * 0.7;
          }
          let sway = Math.sin(t * 1.5 + f.phase) * (0.05 + wave * 0.08);
          if (still) sway = 0;
          const dx = f.x - px;
          const dy = f.y - f.h * 0.6 - py;
          const dist = Math.hypot(dx, dy);
          if (dist < reach) lean += (dx / (dist + 1)) * (1 - dist / reach) * 0.9;
          const ang = lean + sway;
          const sx = Math.sin(ang);
          const cy = Math.cos(ang);
          const tipX = f.x + sx * f.h;
          const tipY = f.y - cy * f.h;
          const cX = f.x + sx * f.h * 0.35;
          const cY = f.y - f.h * 0.6;
          ctx.moveTo(f.x, f.y);
          ctx.quadraticCurveTo(cX, cY, tipX, tipY);

          // The spike: the top of the stem, drawn thick (beaded, see below).
          const u = 0.5;
          const iu = 1 - u;
          tips[f.tone].moveTo(iu * iu * f.x + 2 * iu * u * cX + u * u * tipX, iu * iu * f.y + 2 * iu * u * cY + u * u * tipY);
          tips[f.tone].lineTo(tipX, tipY);
          sizeSum += f.h;
        }
        const size = sizeSum / band.length;
        ctx.setLineDash([]);
        ctx.strokeStyle = o.stem;
        ctx.lineWidth = Math.max(0.5, size * 0.03);
        ctx.stroke();

        // Round caps on a dotted line: each dot is a floret, so the spike is beaded.
        const w = Math.max(1.3, size * o.spike * radius);
        ctx.lineWidth = w;
        ctx.setLineDash(w > 3 ? [0.01, w * 0.95] : []);
        tips.forEach((p, i) => {
          ctx.strokeStyle = colors[i];
          ctx.stroke(p);
        });
      }
      ctx.setLineDash([]);

      if (o.petals && !still) {
        spawn += dt * 0.6;
        while (spawn > 1) {
          spawn -= 1;
          petals.push(newPetal(Math.random() * W * 0.6, H * (0.75 + Math.random() * 0.25), 1));
        }
        ctx.fillStyle = colors[2];
        for (let i = petals.length - 1; i >= 0; i--) {
          const p = petals[i];
          p.vx += (18 + Math.sin(t + p.y * 0.01) * 14 - p.vx) * dt * 0.8;
          p.vy += (Math.sin(t * 1.3 + p.x * 0.01) * 10 - 6 - p.vy) * dt * 0.8;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          p.life -= dt / 9;
          if (p.life <= 0 || p.x > W + 20 || p.y < -20) {
            petals.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.min(1, p.life * 3) * 0.85;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.size * 0.45, p.rot, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };
    redraw.current = () => draw(last);

    const newPetal = (x: number, y: number, power: number): Petal => ({
      x,
      y,
      vx: 20 + Math.random() * 50 * power,
      vy: -10 - Math.random() * 60 * power,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 6,
      life: 0.7 + Math.random() * 0.3,
      size: 2 + Math.random() * 3,
    });

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      if (!still && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const onGust = (e: Event) => {
      const x = (e as CustomEvent<{ x: number }>).detail?.x ?? 0;
      gusts.push({ start: performance.now() / 1000, x: x - 0.1, strength: 1 });
      if (o.petals && petals.length < 160) {
        for (let i = 0; i < 26; i++) petals.push(newPetal(x * W + (Math.random() - 0.5) * 160, H * (0.8 + Math.random() * 0.2), 1.6));
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });

    resize();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("lav:gust", onGust);
    document.addEventListener("visibilitychange", sync);
    if (still) redraw.current();
    else sync();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("lav:gust", onGust);
      document.removeEventListener("visibilitychange", sync);
    };
    // The options are constants per field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);
}

const BACK: FieldOptions = {
  seed: 7,
  ridge: backRidge,
  floor: 0.9,
  density: 6,
  size: [6, 26],
  ground: ["#8a80c4", "#3a3766"],
  stem: "rgb(58 62 92 / 0.55)",
  spike: 0.12,
  maxDpr: 1.75,
};

const FRONT: FieldOptions = {
  seed: 31,
  ridge: frontRidge,
  floor: 1.04,
  density: 1.1,
  size: [40, 112],
  ground: ["#625a9c", "#1d2042"],
  stem: "rgb(40 42 70 / 0.6)",
  spike: 0.16,
  maxDpr: 1.25,
  petals: true,
};

function Field({ opts, bloom, still, className }: { opts: FieldOptions; bloom: number; still: boolean; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useFlowerField(ref, opts, bloom, still);
  return <canvas ref={ref} className={className} />;
}

/* ---------- figure and rocks ---------- */

/* Someone in a long coat, seen from behind, looking at the sky. */
function Figure() {
  return (
    <svg viewBox="0 0 40 124" className="lav-person" style={{ top: `${backRidge(0.5) * 100}%` }}>
      <defs>
        <linearGradient id="lav-coat" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#5b5d82" />
          <stop offset="0.45" stopColor="#30324d" />
          <stop offset="1" stopColor="#1c1e31" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="9.5" rx="5.4" ry="6.2" fill="#2a2c44" />
      <path d="M17.6 15 h4.8 v4 h-4.8 z" fill="#25273d" />
      <path d="M12.6 21 Q20 16.5 27.6 21 L29.4 58 L10.6 58 Z" fill="url(#lav-coat)" />
      <g className="lav-person-hem">
        <path d="M10.6 57 L29.4 57 Q31.2 88 33.6 114 Q20 117.5 6.2 114 Q8.6 88 10.6 57 Z" fill="url(#lav-coat)" />
      </g>
      <path d="M14.5 113 h3.6 v9 h-3.6 z M21.8 113 h3.6 v9 h-3.6 z" fill="#1c1e31" />
      <path d="M12.8 21.5 Q16 19.4 19 18.8" stroke="rgb(214 206 255 / 0.5)" strokeWidth="0.9" fill="none" />
    </svg>
  );
}

function Rock({ x, width, d }: { x: number; width: string; d: string }) {
  return (
    <svg viewBox="0 0 100 50" className="lav-rock" style={{ left: `${x * 100}%`, top: `${backRidge(x) * 100}%`, width }}>
      <defs>
        <linearGradient id={`lav-rock-${x}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d6d92" />
          <stop offset="1" stopColor="#2f304b" />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#lav-rock-${x})`} />
    </svg>
  );
}

/* ---------- the scene ---------- */

export function FieldScene({ bloom }: { bloom: number }) {
  const still = !!useReducedMotion();
  const { scrollY: pageY } = useScroll();
  const zero = useMotionValue(0);
  const scrollY = still ? zero : pageY;

  const pxRaw = useMotionValue(0);
  const px = useSpring(pxRaw, { stiffness: 40, damping: 18, mass: 0.9 });
  useEffect(() => {
    if (still) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") pxRaw.set(e.clientX / window.innerWidth - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [still, pxRaw]);

  const skyY = useTransform(scrollY, (v) => v * 0.7);
  const mistY = useTransform(scrollY, (v) => v * 0.5);
  const backY = useTransform(scrollY, (v) => v * 0.32);
  const nearMistY = useTransform(scrollY, (v) => v * 0.2);
  const frontY = useTransform(scrollY, (v) => v * 0.06);
  const skyX = useTransform(px, (v) => v * -6);
  const backX = useTransform(px, (v) => v * -16);
  const frontX = useTransform(px, (v) => v * -40);

  return (
    <div aria-hidden className="lav-scene">
      <motion.div className="lav-layer lav-sky" style={{ y: skyY, x: skyX }}>
        <Sky bloom={bloom} still={still} />
      </motion.div>

      <motion.div className="lav-layer lav-mist" style={{ y: mistY }}>
        <span />
        <span />
        <span />
      </motion.div>

      <motion.div className="lav-layer lav-back" style={{ y: backY, x: backX }}>
        <Field opts={BACK} bloom={bloom} still={still} className="lav-canvas" />
        <Rock x={0.17} width="clamp(3.5rem, 7vw, 6.5rem)" d="M4 50 Q6 26 22 18 Q34 6 52 12 Q70 8 84 22 Q96 34 97 50 Z" />
        <Rock x={0.84} width="clamp(6rem, 13vw, 12rem)" d="M2 50 Q8 30 20 26 Q26 10 44 8 Q60 2 72 14 Q88 16 94 32 Q99 42 99 50 Z" />
        <Figure />
      </motion.div>

      <motion.div className="lav-layer lav-mist lav-mist-near" style={{ y: nearMistY }}>
        <span />
        <span />
      </motion.div>

      <motion.div className="lav-layer lav-front" style={{ y: frontY, x: frontX }}>
        <Field opts={FRONT} bloom={bloom} still={still} className="lav-canvas lav-canvas-front" />
      </motion.div>

      <div className="lav-shade" />
    </div>
  );
}
