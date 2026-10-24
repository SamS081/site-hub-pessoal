"use client";

import { useEffect, useRef } from "react";

/*
 * The Notas sky ("Luz"): above the clouds at golden hour, in one fragment
 * shader, back to front.
 *
 *   the opening  warm sky, cream by the sun (high on the right), peach away
 *                from it, a cool haze low on the left.
 *   the light    a field of backlit cumulus, domain-warped noise lit toward
 *                the sun, with a silver lining on every edge; the sun's glow
 *                and faint rays on top.
 *   the frame    dark storm clouds closing in from the edges, low-frequency
 *                noise only so they read as near and out of focus, their
 *                inner edges warmed by the light they surround.
 *
 * Scrolling down lowers the sun and lets the frame close a little, toward
 * dusk, so the notes below sit on calmer ground. Rendered at ~0.6x the CSS
 * size; stops while the tab is hidden; the near clouds follow the pointer
 * more than the far ones. With reduced motion it draws one still frame.
 */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uLook;
uniform float uScroll;

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
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

float field(vec2 q, vec2 w, float t) {
  return fbm(q * 2.6 + w * 1.1 + vec2(t * 0.8, 0.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float aspect = uRes.x / uRes.y;
  float t = uTime * 0.02;
  float sc = uScroll;

  /* the opening */
  vec2 sun = vec2(aspect * 0.24, 0.42 + sc * 0.1);
  float ds = length(p - sun);
  float sunNear = exp(-ds * 2.2);
  vec3 cream = vec3(1.0, 0.93, 0.82);
  vec3 peach = vec3(0.88, 0.66, 0.52);
  vec3 haze = vec3(0.6, 0.63, 0.66);
  vec3 col = mix(peach, cream, exp(-ds * ds * 5.0));
  col = mix(col, haze, smoothstep(0.1, -0.7, p.y - p.x * 0.3) * 0.45);

  /* the light: backlit cumulus */
  vec2 mp = p + uLook * 0.02 + vec2(0.0, sc * 0.25);
  vec2 w = vec2(fbm(mp * 2.2 + vec2(t, 0.0)), fbm(mp * 2.2 + vec2(3.1, 1.7) - vec2(0.0, t)));
  float c = field(mp, w, t);
  float dm = smoothstep(0.4, 0.6, c);
  float c2 = field(mp + normalize(sun - mp) * 0.03, w, t);
  float lit = clamp(0.5 + (c - c2) * 12.0, 0.0, 1.0);
  vec3 shade = mix(vec3(0.68, 0.49, 0.42), vec3(0.88, 0.7, 0.58), sunNear);
  vec3 light = mix(vec3(1.0, 0.85, 0.69), vec3(1.0, 0.95, 0.86), sunNear);
  vec3 mid = mix(shade, light, lit);
  float rim = dm * (1.0 - dm) * 4.0;
  mid += vec3(1.0, 0.9, 0.75) * rim * 0.22 * (0.4 + sunNear);
  col = mix(col, mid, dm * 0.9);

  // The sun, and faint rays from it.
  col += vec3(1.0, 0.95, 0.85) * exp(-ds * ds * 26.0) * 0.5;
  float ang = atan(p.y - sun.y, p.x - sun.x);
  float rays = fbm3(vec2(ang * 6.0, t * 2.0)) * exp(-ds * 1.8);
  col += vec3(1.0, 0.9, 0.75) * smoothstep(0.42, 0.8, rays) * 0.12;

  /* the frame: near storm clouds, out of focus */
  vec2 fp = p + uLook * 0.05 + vec2(0.0, sc * 0.45);
  vec2 radii = aspect > 1.0 ? vec2(aspect * 0.46, 0.47) : vec2(aspect * 0.62, 0.5);
  float r = length((fp - vec2(aspect * 0.02, 0.03)) / radii);
  float fn = fbm(fp * 1.7 + vec2(t * 0.5, -t * 0.3));
  float frame = smoothstep(0.86, 1.12, r + (fn - 0.5) * 0.95 + sc * 0.12);
  float fd = fbm3(fp * 3.0 + vec2(-t * 0.4, t * 0.2));
  vec3 dark = mix(vec3(0.14, 0.15, 0.19), vec3(0.42, 0.4, 0.42), fd);
  float edge = frame * (1.0 - frame) * 4.0;
  dark = mix(dark, vec3(0.8, 0.63, 0.52), edge * 0.42);
  col = mix(col, dark, frame * 0.95);

  // Toward dusk as the page goes down.
  col = mix(col, col * vec3(0.66, 0.58, 0.6), smoothstep(0.3, 1.3, sc) * 0.5);

  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.016;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export function CloudSky({ onReady }: { onReady?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    // Without WebGL the canvas steps aside and the CSS gradient behind it shows.
    const giveUp = () => {
      canvas.style.display = "none";
      onReady?.();
    };
    if (!gl) {
      giveUp();
      return;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      giveUp();
      return;
    }
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
    const uScroll = gl.getUniformLocation(prog, "uScroll");

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    let scroll = 0;
    let raf = 0;
    let first = true;
    const t0 = performance.now() - 30_000;

    const draw = (now: number) => {
      look.x += (look.tx - look.x) * 0.035;
      look.y += (look.ty - look.y) * 0.035;
      const target = Math.min(window.scrollY / window.innerHeight, 2);
      scroll += (target - scroll) * 0.08;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform2f(uLook, look.x, look.y);
      gl.uniform1f(uScroll, scroll);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (first) {
        first = false;
        onReady?.();
      }
    };

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (still) draw(t0 + 30_000);
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      look.tx = e.clientX / window.innerWidth - 0.5;
      look.ty = 0.5 - e.clientY / window.innerHeight;
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    const onScroll = () => {
      scroll = Math.min(window.scrollY / window.innerHeight, 2);
      draw(t0 + 30_000);
    };

    resize();
    window.addEventListener("resize", resize);
    if (still) {
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      // Free what this run made, but keep the context: the canvas may be set up again (Strict Mode).
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [onReady]);

  return <canvas ref={ref} aria-hidden className="luz-canvas" />;
}
