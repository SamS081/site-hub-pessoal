"use client";

import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/*
 * The centre of the home: a diorama atoll at night. A round slice of ocean
 * cut like a specimen, its glassy turquoise walls showing the depth (light at
 * the waterline, dark at the seabed), faceted waves on top; on it a low-poly
 * island (beach ring, green interior, a rocky hill), a broken coral reef
 * around the lagoon with two sand islets, three palms and a striped
 * lighthouse whose warm lantern is the one hot point of the picture. Fireflies
 * drift over the water.
 *
 * Everything is procedural and seeded (no assets, same island every visit).
 * The canvas is transparent: the page's night-ocean backdrop shows through.
 * Motion: rises in once, bobs, turns once every ~105 s, tilts a little with a
 * fine pointer. Reduced motion gets one still frame (frameloop "demand").
 * Rendering stops when the tab is hidden or the stage is off screen. No WebGL,
 * or a crash: a flat SVG silhouette instead. Decorative only.
 */

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ layout */

const WATER_R = 1.6;
const DEPTH = 0.68;
const REEF_R = 1.2;
/* Main island: centre (x, z) and mean shore radius. */
const ISLE = { x: -0.14, z: 0.05, r: 0.7 } as const;
const BASE_YAW = -0.5;
const TURN_SECONDS = 105;

/* Palette: lagoon turquoise, coral, sky blue, sand, abyss. */
const C = {
  deep: "#0d5866",
  lagoon: "#2fd3c0",
  shallow: "#8ff0dc",
  foam: "#eafff8",
  wallTop: "#3fdcc8",
  wallBottom: "#062a33",
  rim: "#8fd8ff",
  key: "#ffc4a0",
  coral: "#ff6a4d",
  sand: "#eee6d3",
  abyss: "#04121a",
  lantern: "#ffc27a",
} as const;

/* Seeded PRNG (mulberry32): deterministic geometry, never Math.random. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PH = (() => {
  const r = rng(7);
  return Array.from({ length: 5 }, () => r() * TAU);
})();

/* Shore radius at an angle around the island centre: a lumpy circle. */
function shoreR(a: number) {
  return ISLE.r * (1 + 0.1 * Math.sin(2 * a + PH[0]) + 0.06 * Math.sin(3 * a + PH[1]) + 0.035 * Math.sin(5 * a + PH[2]));
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/*
 * Ground height at a point given in island-local coordinates, with t the
 * share of the shore radius (1 = waterline). Plateau, then the beach slope,
 * a short underwater shelf, then the mound down to the seabed.
 */
function groundY(t: number, x: number, z: number) {
  const hill = 0.3 * Math.exp(-((x - 0.14) ** 2 + (z + 0.12) ** 2) / 0.045) * (1 - smooth(0.45, 0.85, t));
  if (t <= 0.72) return 0.085 + 0.018 * Math.sin(x * 9 + PH[3]) * Math.sin(z * 8 + PH[4]) + hill;
  if (t <= 1) return lerp(0.085, -0.012, smooth(0.72, 1, t) * 0.6 + ((t - 0.72) / 0.28) * 0.4) + hill;
  if (t <= 1.15) return lerp(-0.012, -0.12, (t - 1) / 0.15);
  return lerp(-0.12, -DEPTH + 0.03, Math.min(1, (t - 1.15) / 0.5));
}

/* A spot on the island by angle and shore share: island-local [x, y, z]. */
function spot(a: number, t: number): [number, number, number] {
  const r = shoreR(a) * t;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  return [x, groundY(t, x, z), z];
}

/* -------------------------------------------------------------- geometries */

function islandGeometry() {
  const rand = rng(21);
  const S = 44;
  const rings = [0.12, 0.26, 0.4, 0.54, 0.66, 0.74, 0.82, 0.91, 1, 1.08, 1.18, 1.42, 1.65];
  const pos: number[] = [];
  const ts: number[] = [];
  const push = (a: number, t: number) => {
    const [x, y, z] = spot(a, t);
    pos.push(x, y, z);
    ts.push(t);
  };
  push(0, 0);
  rings.forEach((t, j) => {
    const last = j === rings.length - 1;
    for (let i = 0; i < S; i++) {
      const a = ((i + (j % 2) * 0.5) / S) * TAU + (last ? 0 : (rand() - 0.5) * 0.35 * (TAU / S));
      push(a, last ? t : t * (1 + (rand() - 0.5) * 0.04));
    }
  });
  const idx: number[] = [];
  const v = (j: number, i: number) => 1 + j * S + (((i % S) + S) % S);
  for (let i = 0; i < S; i++) idx.push(0, v(0, i + 1), v(0, i));
  for (let j = 0; j < rings.length - 1; j++) {
    const shift = j % 2; // odd rings are offset by half a step
    for (let i = 0; i < S; i++) {
      const a = v(j, i);
      const b = v(j, i + 1);
      const c = v(j + 1, i - 1 + shift);
      const d = v(j + 1, i + shift);
      idx.push(a, b, d, a, d, c);
    }
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  indexed.setAttribute("t", new THREE.Float32BufferAttribute(ts, 1));
  indexed.setIndex(idx);
  const geo = indexed.toNonIndexed();
  indexed.dispose();

  /* One flat colour per face, chosen from the face centre. */
  const p = geo.getAttribute("position");
  const tt = geo.getAttribute("t");
  const col = new Float32Array(p.count * 3);
  const greens = ["#3e9a62", "#2f8455", "#56ad6c", "#357f52"].map((h) => new THREE.Color(h));
  const sands = ["#eadbb4", "#e0cfa2", "#efe3c2"].map((h) => new THREE.Color(h));
  const rocks = ["#7d8784", "#6a7472", "#8d958f"].map((h) => new THREE.Color(h));
  const wet = new THREE.Color("#bba679");
  const under = new THREE.Color("#7f9c86");
  const mound = new THREE.Color("#3f716a");
  const pick = rng(5);
  const c = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const t = (tt.getX(f) + tt.getX(f + 1) + tt.getX(f + 2)) / 3;
    const r = pick();
    if (y > 0.24) c.copy(rocks[Math.floor(r * rocks.length)]);
    else if (t < 0.75) c.copy(greens[Math.floor(r * greens.length)]);
    else if (y > -0.004) c.copy(sands[Math.floor(r * sands.length)]);
    else if (y > -0.06) c.copy(wet);
    else if (y > -0.2) c.copy(under);
    else c.copy(mound);
    for (let k = 0; k < 3; k++) c.toArray(col, (f + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute("t");
  geo.computeVertexNormals();
  return geo;
}

/* A palm frond along +x: rises, then droops; V-folded, with saw-tooth edges. */
function frondGeometry() {
  const L = 0.36;
  const n = 8;
  const rows: [number, number, number][][] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = s * L;
    const y = 0.06 * s - 0.24 * s * s;
    const w = Math.sin(Math.PI * Math.min(1, s * 1.08)) * 0.065 * (i % 2 === 0 ? 1 : 0.55);
    const fold = w * 0.5;
    rows.push([
      [x, y - fold, -w],
      [x, y, 0],
      [x, y - fold, w],
    ]);
  }
  const pos: number[] = [];
  const tri = (...pts: [number, number, number][]) => pts.forEach((q) => pos.push(...q));
  for (let i = 0; i < n; i++) {
    const [l0, m0, r0] = rows[i];
    const [l1, m1, r1] = rows[i + 1];
    tri(l0, m0, l1);
    tri(m0, m1, l1);
    tri(m0, r0, m1);
    tri(r0, r1, m1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/* Soft round sprite: white centre to transparent, used for glows and the contact shadow. */
function radialTexture(stops: [number, string][]) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ----------------------------------------------------------------- shaders */

const KEY_DIR = new THREE.Vector3(-3, 2.4, 2).normalize();
const RIM_DIR = new THREE.Vector3(2, 1.4, -3).normalize();

const waterVertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vLocal;
  void main() {
    vec3 p = position;
    float r = length(p.xz);
    float amp = mix(0.009, 0.022, smoothstep(1.05, 1.35, r)) * (1.0 - 0.6 * smoothstep(1.45, 1.6, r));
    float w = sin(p.x * 3.1 + uTime * 1.1) * 0.5
            + sin(p.z * 2.6 - uTime * 0.85) * 0.5
            + sin((p.x + p.z) * 5.3 + uTime * 1.7) * 0.25;
    p.y += amp * w;
    vLocal = p;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep, uLagoon, uShallow, uFoam, uKey, uRim, uKeyDir;
  uniform vec2 uIsle;
  uniform float uIsleR, uReefR;
  uniform vec3 uPh;
  varying vec3 vWorld;
  varying vec3 vLocal;

  float shore(float a) {
    return uIsleR * (1.0 + 0.1 * sin(2.0 * a + uPh.x) + 0.06 * sin(3.0 * a + uPh.y) + 0.035 * sin(5.0 * a + uPh.z));
  }

  void main() {
    // Flat facets: one normal per triangle, from screen-space derivatives.
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.y < 0.0) n = -n;
    vec3 v = normalize(cameraPosition - vWorld);

    vec2 q = vLocal.xz - uIsle;
    float qa = atan(q.y, q.x);
    float d = length(q) / shore(qa);
    float r = length(vLocal.xz);
    float lagoon = 1.0 - smoothstep(uReefR - 0.08, uReefR + 0.06, r);

    vec3 col = mix(uDeep, uLagoon, lagoon * 0.85);
    col = mix(col, uShallow, (1.0 - smoothstep(1.0, 1.75, d)) * 0.8);
    col *= 0.62 + 0.48 * max(dot(n, uKeyDir), 0.0);

    vec3 h = normalize(uKeyDir + v);
    col += uKey * pow(max(dot(n, h), 0.0), 70.0) * 0.8;
    col += uRim * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.3;

    float foamIsle = 1.0 - smoothstep(1.0, 1.12 + 0.035 * sin(uTime * 1.3 + qa * 6.0), d);
    float reef = 1.0 - smoothstep(0.0, 0.05, abs(r - uReefR));
    float broken = smoothstep(0.1, 0.8, sin(atan(vLocal.z, vLocal.x) * 9.0 + uTime * 0.5) * 0.5 + 0.5);
    col = mix(col, uFoam, clamp(foamIsle * 0.75 + reef * broken * 0.45, 0.0, 0.85));

    gl_FragColor = vec4(col, mix(0.84, 0.66, lagoon));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const wallVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const wallFragment = /* glsl */ `
  uniform float uTime, uBack;
  uniform vec3 uTop, uBottom, uRim;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    float y = vUv.y;
    vec3 col = mix(uBottom, uTop, pow(y, 2.2));
    float a = mix(0.95, 0.4, y);
    vec3 v = normalize(cameraPosition - vWorld);
    col += uRim * pow(1.0 - abs(dot(normalize(vNormalW), v)), 2.0) * 0.35;
    // Faint light shafts drifting down the glass.
    float band = sin(vUv.x * 140.0 + y * 5.0 + uTime * 0.35) * sin(vUv.x * 53.0 - uTime * 0.25);
    col += uTop * smoothstep(0.55, 1.0, band) * 0.12 * y;
    col += uRim * smoothstep(0.94, 1.0, y) * 0.45;
    col *= mix(1.0, 0.5, uBack);
    a *= mix(1.0, 0.75, uBack);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const sparkVertex = /* glsl */ `
  uniform float uTime, uScale;
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float life = fract(uTime * 0.03 + aSeed);
    p.y += life * 0.9;
    p.x += sin(uTime * 0.6 + aSeed * 30.0) * 0.06;
    p.z += cos(uTime * 0.5 + aSeed * 20.0) * 0.06;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.55 + 0.45 * sin(uTime * 2.2 + aSeed * 50.0);
    vAlpha = twinkle * smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.7, 1.0, life));
    vColor = aColor;
    gl_PointSize = aSize * uScale / -mv.z;
  }
`;

const sparkFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ pieces */

type Mats = ReturnType<typeof useMaterials>;

function useMaterials() {
  return useMemo(() => {
    const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra });
    return {
      land: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 }),
      trunkA: flat("#8a6848"),
      trunkB: flat("#a3805a"),
      leafA: flat("#3fae6a", { side: THREE.DoubleSide }),
      leafB: flat("#2e9159", { side: THREE.DoubleSide }),
      nut: flat("#6b4a2f"),
      rock: flat("#76817f"),
      reef: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8, metalness: 0 }),
      ridge: flat("#4f8f84", { roughness: 1 }),
      motu: flat("#e6d6ab"),
      seabed: flat("#1f5654", { roughness: 1 }),
      tower: flat(C.sand, { roughness: 0.6 }),
      stripe: flat(C.coral, { roughness: 0.6 }),
      dark: flat("#3a4f52"),
      lantern: new THREE.MeshBasicMaterial({ color: C.lantern, toneMapped: false }),
    };
  }, []);
}

function useGeometries() {
  return useMemo(
    () => ({
      island: islandGeometry(),
      frond: frondGeometry(),
      trunk: new THREE.CylinderGeometry(1, 1.12, 1, 6, 1),
      nut: new THREE.IcosahedronGeometry(1, 0),
      rock: new THREE.DodecahedronGeometry(1, 0),
      motu: new THREE.IcosahedronGeometry(1, 1),
    }),
    [],
  );
}

type Geos = ReturnType<typeof useGeometries>;

function Palm({
  at,
  yaw,
  height = 0.42,
  lean = 0.12,
  geos,
  mats,
  seed,
}: {
  at: [number, number, number];
  yaw: number;
  height?: number;
  lean?: number;
  geos: Geos;
  mats: Mats;
  seed: number;
}) {
  const { segments, top, fronds } = useMemo(() => {
    const n = 7;
    const up = new THREE.Vector3(0, 1, 0);
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const s = i / n;
      return new THREE.Vector3(lean * s * s, s * height, 0);
    });
    const segs = pts.slice(0, -1).map((p0, i) => {
      const p1 = pts[i + 1];
      const dir = p1.clone().sub(p0);
      const len = dir.length();
      const r = 0.024 * (1 - 0.35 * (i / n));
      return {
        pos: p0.clone().add(p1).multiplyScalar(0.5).toArray() as [number, number, number],
        quat: new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()),
        scale: [r, len * 1.04, r] as [number, number, number],
      };
    });
    const rand = rng(seed);
    const fr = Array.from({ length: 7 }, (_, k) => ({
      yaw: (k / 7) * TAU + (rand() - 0.5) * 0.4,
      pitch: 0.18 + rand() * 0.3,
      scale: 0.85 + rand() * 0.3,
    }));
    return { segments: segs, top: pts[n].toArray() as [number, number, number], fronds: fr };
  }, [height, lean, seed]);

  return (
    <group position={at} rotation={[0, yaw, 0]}>
      {segments.map((s, i) => (
        <mesh
          key={i}
          geometry={geos.trunk}
          material={i % 2 ? mats.trunkB : mats.trunkA}
          position={s.pos}
          quaternion={s.quat}
          scale={s.scale}
        />
      ))}
      <group position={top}>
        {fronds.map((f, i) => (
          <group key={i} rotation={[0, f.yaw, 0]}>
            <mesh
              geometry={geos.frond}
              material={i % 2 ? mats.leafB : mats.leafA}
              rotation={[0, 0, f.pitch]}
              scale={f.scale}
            />
          </group>
        ))}
        {[0, 2.1, 4.2].map((a) => (
          <mesh
            key={a}
            geometry={geos.nut}
            material={mats.nut}
            position={[Math.cos(a) * 0.022, -0.02, Math.sin(a) * 0.022]}
            scale={0.017}
          />
        ))}
      </group>
    </group>
  );
}

function Rock({ at, scale, rot = 0, geos, mats }: { at: [number, number, number]; scale: [number, number, number]; rot?: number; geos: Geos; mats: Mats }) {
  return <mesh geometry={geos.rock} material={mats.rock} position={at} scale={scale} rotation={[rot, rot * 1.7, rot * 0.6]} />;
}

/* The focal point: a striped lighthouse on the beach, its lantern lit. */
function Lighthouse({ at, mats, glow, glowRef }: { at: [number, number, number]; mats: Mats; glow: THREE.Texture; glowRef: RefObject<THREE.Sprite | null> }) {
  const geos = useMemo(() => {
    const H = 0.34;
    const rAt = (y: number) => 0.062 - 0.02 * (y / H);
    const band = (y0: number, y1: number) => new THREE.CylinderGeometry(rAt(y1) + 0.002, rAt(y0) + 0.002, y1 - y0, 10);
    return {
      H,
      body: new THREE.CylinderGeometry(rAt(H), rAt(0), H, 10),
      bands: [band(0.08, 0.13), band(0.2, 0.25)],
      bandY: [0.105, 0.225],
      gallery: new THREE.CylinderGeometry(0.06, 0.055, 0.012, 10),
      lantern: new THREE.CylinderGeometry(0.036, 0.036, 0.06, 8),
      roof: new THREE.ConeGeometry(0.052, 0.07, 8),
      base: new THREE.DodecahedronGeometry(1, 0),
    };
  }, []);
  const top = geos.H + 0.01;
  return (
    <group position={at}>
      <mesh geometry={geos.base} material={mats.rock} position={[0, -0.01, 0]} scale={[0.11, 0.05, 0.1]} />
      <mesh geometry={geos.body} material={mats.tower} position={[0, geos.H / 2, 0]} />
      {geos.bands.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.stripe} position={[0, geos.bandY[i], 0]} />
      ))}
      <mesh geometry={geos.gallery} material={mats.dark} position={[0, top, 0]} />
      <mesh geometry={geos.lantern} material={mats.lantern} position={[0, top + 0.036, 0]} />
      <mesh geometry={geos.roof} material={mats.stripe} position={[0, top + 0.098, 0]} />
      <pointLight color="#ffb27a" intensity={0.9} distance={1.8} decay={1.8} position={[0, top + 0.04, 0.02]} />
      <sprite ref={glowRef} position={[0, top + 0.036, 0]} scale={1.2}>
        <spriteMaterial map={glow} color="#ffb070" blending={THREE.AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
      </sprite>
    </group>
  );
}

/* The reef: coral heads along a ring with three breaks, plus an underwater ridge. */
function Reef({ geos, mats }: { geos: Geos; mats: Mats }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 86;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rand = rng(33);
    const gaps: [number, number][] = [
      [1.6, 0.36],
      [3.95, 0.26],
      [-0.85, 0.2],
    ];
    const tints = ["#ff6a4d", "#ff8a68", "#f2a07f", "#e9d9b5", "#f6c9a8", "#ff7a5c"].map((h) => new THREE.Color(h));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let i = 0;
    while (i < COUNT) {
      const a = rand() * TAU - Math.PI;
      if (gaps.some(([g, w]) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < w)) continue;
      const r = REEF_R + (rand() - 0.5) * 0.1;
      const s = 0.022 + rand() * 0.034;
      e.set(rand() * 3, rand() * 3, rand() * 3);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, -0.026 + rand() * 0.032, Math.sin(a) * r),
        q,
        new THREE.Vector3(s * (1 + rand()), s * 0.8, s),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, tints[Math.floor(rand() * tints.length)]);
      i++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  const ridge = useMemo(() => new THREE.TorusGeometry(REEF_R, 0.11, 5, 72), []);
  return (
    <group>
      <instancedMesh ref={ref} args={[geos.rock, mats.reef, COUNT]} />
      <mesh geometry={ridge} material={mats.ridge} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.13, 0]} scale={[1, 1, 0.55]} />
    </group>
  );
}

function Water({ timeRef }: { timeRef: RefObject<number> }) {
  const top = useRef<THREE.ShaderMaterial>(null);
  const back = useRef<THREE.ShaderMaterial>(null);
  const front = useRef<THREE.ShaderMaterial>(null);

  const { surface, walls, uniforms } = useMemo(() => {
    const surface = new THREE.RingGeometry(0.001, WATER_R, 96, 26).rotateX(-Math.PI / 2);
    const walls = new THREE.CylinderGeometry(WATER_R, WATER_R, DEPTH, 96, 1, true).translate(0, -DEPTH / 2, 0);
    const col = (h: string) => new THREE.Color(h);
    const wall = (b: number) => ({
      uTime: { value: 0 },
      uBack: { value: b },
      uTop: { value: col(C.wallTop) },
      uBottom: { value: col(C.wallBottom) },
      uRim: { value: col(C.rim) },
    });
    return {
      surface,
      walls,
      uniforms: {
        top: {
          uTime: { value: 0 },
          uDeep: { value: col(C.deep) },
          uLagoon: { value: col(C.lagoon) },
          uShallow: { value: col(C.shallow) },
          uFoam: { value: col(C.foam) },
          uKey: { value: col(C.key) },
          uRim: { value: col(C.rim) },
          uKeyDir: { value: KEY_DIR.clone() },
          uIsle: { value: new THREE.Vector2(ISLE.x, ISLE.z) },
          uIsleR: { value: ISLE.r },
          uReefR: { value: REEF_R },
          uPh: { value: new THREE.Vector3(PH[0], PH[1], PH[2]) },
        },
        back: wall(1),
        front: wall(0),
      },
    };
  }, []);

  useFrame(() => {
    const t = timeRef.current;
    for (const m of [top.current, back.current, front.current]) if (m) m.uniforms.uTime.value = t;
  });

  return (
    <group>
      {/* Order: far glass, surface, near glass; none writes depth. */}
      <mesh geometry={walls} renderOrder={1}>
        <shaderMaterial ref={back} vertexShader={wallVertex} fragmentShader={wallFragment} uniforms={uniforms.back} transparent depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={surface} renderOrder={2}>
        <shaderMaterial ref={top} vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={uniforms.top} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={walls} renderOrder={3}>
        <shaderMaterial ref={front} vertexShader={wallVertex} fragmentShader={wallFragment} uniforms={uniforms.front} transparent depthWrite={false} side={THREE.FrontSide} />
      </mesh>
      {/* Bright hairline at the waterline, a fainter one at the floor. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={4}>
        <torusGeometry args={[WATER_R, 0.007, 4, 128]} />
        <meshBasicMaterial color="#c9fbf1" toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -DEPTH, 0]} renderOrder={4}>
        <torusGeometry args={[WATER_R, 0.005, 4, 128]} />
        <meshBasicMaterial color={C.rim} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function Sparks({ timeRef }: { timeRef: RefObject<number> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const { geometry, uniforms } = useMemo(() => {
    const N = 64;
    const rand = rng(11);
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const sz = new Float32Array(N);
    const colr = new Float32Array(N * 3);
    const warm = new THREE.Color("#ffc58f");
    const cool = new THREE.Color(C.rim);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = rand() * TAU;
      const r = 0.3 + Math.sqrt(rand()) * 1.55;
      pos.set([Math.cos(a) * r, 0.05 + rand() * 0.55, Math.sin(a) * r], i * 3);
      seed[i] = rand();
      sz[i] = 0.025 + rand() * 0.05;
      c.copy(rand() < 0.4 ? warm : cool).toArray(colr, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(colr, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 2.5);
    return { geometry: g, uniforms: { uTime: { value: 0 }, uScale: { value: 800 } } };
  }, []);

  useFrame((state) => {
    const m = mat.current;
    if (!m) return;
    const cam = state.camera as THREE.PerspectiveCamera;
    m.uniforms.uTime.value = timeRef.current;
    m.uniforms.uScale.value = (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  });

  return (
    <points geometry={geometry} renderOrder={5}>
      <shaderMaterial ref={mat} vertexShader={sparkVertex} fragmentShader={sparkFragment} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/* --------------------------------------------------------------- the scene */

const ISLE_SPOTS = {
  lighthouse: spot(0.55, 0.86),
  palms: [
    { at: spot(2.2, 0.5), yaw: 2.6, height: 0.44, lean: 0.13, seed: 1 },
    { at: spot(2.8, 0.8), yaw: 3.4, height: 0.36, lean: 0.16, seed: 2 },
    { at: spot(3.9, 0.66), yaw: 4.3, height: 0.4, lean: 0.1, seed: 3 },
  ],
  rocks: [
    { at: spot(-0.75, 0.32), scale: [0.07, 0.06, 0.06] as [number, number, number], rot: 0.4 },
    { at: spot(-0.5, 0.4), scale: [0.045, 0.04, 0.05] as [number, number, number], rot: 1.1 },
    { at: spot(-0.95, 0.42), scale: [0.04, 0.035, 0.04] as [number, number, number], rot: 2.2 },
    { at: spot(1.25, 0.98), scale: [0.05, 0.035, 0.04] as [number, number, number], rot: 0.8 },
    { at: spot(4.7, 1.0), scale: [0.04, 0.03, 0.05] as [number, number, number], rot: 1.7 },
    { at: spot(0.85, 0.96), scale: [0.03, 0.025, 0.03] as [number, number, number], rot: 2.9 },
  ],
} as const;

const MOTUS = [
  { a: 0.35, len: 0.2, w: 0.08 },
  { a: -2.35, len: 0.15, w: 0.065 },
] as const;

function Diorama({ reduced }: { reduced: boolean }) {
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const timeRef = useRef(reduced ? 2.4 : 0);
  const pointer = useRef({ x: 0, y: 0, cx: 0, cy: 0 });
  const mats = useMaterials();
  const geos = useGeometries();
  const textures = useMemo(
    () => ({
      glow: radialTexture([
        [0, "rgba(255,255,255,1)"],
        [0.18, "rgba(255,255,255,0.55)"],
        [0.5, "rgba(255,255,255,0.12)"],
        [1, "rgba(255,255,255,0)"],
      ]),
      shadow: radialTexture([
        [0, "rgba(0,0,0,0.6)"],
        [0.55, "rgba(0,0,0,0.25)"],
        [1, "rgba(0,0,0,0)"],
      ]),
    }),
    [],
  );

  useEffect(() => {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

  useFrame((_, delta) => {
    const r = root.current;
    const tg = tilt.current;
    const sp = spin.current;
    if (!r || !tg || !sp) return;
    if (reduced) {
      sp.rotation.y = BASE_YAW;
      return;
    }
    const dt = Math.min(delta, 1 / 20); // no jump after a pause
    const t = (timeRef.current += dt);

    const p = Math.min(1, t / 2);
    const e = 1 - (1 - p) ** 4;
    r.position.y = (1 - e) * -0.45 + Math.sin(t * 0.55) * 0.03;
    r.scale.setScalar(0.86 + 0.14 * e);
    r.rotation.z = Math.sin(t * 0.4) * 0.012;

    const k = 1 - Math.exp(-dt * 2.5);
    const pt = pointer.current;
    pt.cx += (pt.x - pt.cx) * k;
    pt.cy += (pt.y - pt.cy) * k;
    tg.rotation.x = pt.cy * 0.07;
    tg.rotation.z = -pt.cx * 0.04;
    sp.rotation.y = BASE_YAW + (t / TURN_SECONDS) * TAU + pt.cx * 0.15 + (1 - e) * -0.6;

    const g = glowRef.current;
    if (g) g.material.opacity = 0.85 + Math.sin(t * 1.7) * 0.08 + Math.sin(t * 4.3) * 0.04;
  });

  return (
    <>
      <hemisphereLight args={["#8fd8ff", C.abyss, 0.55]} />
      <directionalLight color={C.key} intensity={2.4} position={KEY_DIR.clone().multiplyScalar(6)} />
      <directionalLight color="#5fe0ff" intensity={1.5} position={RIM_DIR.clone().multiplyScalar(6)} />

      <group ref={root}>
        <group ref={tilt}>
          <group ref={spin} rotation={[0, BASE_YAW, 0]}>
            <mesh geometry={geos.island} material={mats.land} position={[ISLE.x, 0, ISLE.z]} />
            <group position={[ISLE.x, 0, ISLE.z]}>
              <Lighthouse at={ISLE_SPOTS.lighthouse as [number, number, number]} mats={mats} glow={textures.glow} glowRef={glowRef} />
              {ISLE_SPOTS.palms.map((p) => (
                <Palm key={p.seed} at={p.at as [number, number, number]} yaw={p.yaw} height={p.height} lean={p.lean} seed={p.seed} geos={geos} mats={mats} />
              ))}
              {ISLE_SPOTS.rocks.map((k, i) => (
                <Rock key={i} at={k.at as [number, number, number]} scale={k.scale} rot={k.rot} geos={geos} mats={mats} />
              ))}
            </group>

            <Reef geos={geos} mats={mats} />
            {MOTUS.map((m, i) => (
              <mesh
                key={i}
                geometry={geos.motu}
                material={mats.motu}
                position={[Math.cos(m.a) * REEF_R, -0.012, Math.sin(m.a) * REEF_R]}
                rotation={[0, -(m.a + Math.PI / 2), 0]}
                scale={[m.len, 0.045, m.w]}
              />
            ))}
            <Palm
              at={[Math.cos(MOTUS[0].a) * REEF_R, 0.02, Math.sin(MOTUS[0].a) * REEF_R]}
              yaw={0.9}
              height={0.3}
              lean={0.14}
              seed={4}
              geos={geos}
              mats={mats}
            />

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -DEPTH + 0.002, 0]} material={mats.seabed}>
              <circleGeometry args={[WATER_R * 0.995, 48]} />
            </mesh>
            <Water timeRef={timeRef} />
          </group>
        </group>

        {/* Faked contact shadow on the page beneath the diorama. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -DEPTH - 0.12, 0]} renderOrder={0}>
          <planeGeometry args={[WATER_R * 3.2, WATER_R * 3.2]} />
          <meshBasicMaterial map={textures.shadow} transparent depthWrite={false} />
        </mesh>
        <Sparks timeRef={timeRef} />
      </group>
    </>
  );
}

/*
 * Framing: the camera looks down ~27°, and backs off so the diorama spans a
 * set share of the stage width (smaller on the wide stage, where the drawn
 * rings need room around it).
 */
const FOV = 30;
const PITCH = THREE.MathUtils.degToRad(27);
function Rig() {
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useLayoutEffect(() => {
    const { camera, invalidate } = get();
    const aspect = width / Math.max(1, height);
    const share = aspect >= 1 ? 0.7 : 0.92;
    const visW = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect;
    const dist = (WATER_R * 2.05) / (share * visW);
    camera.position.set(0, Math.sin(PITCH) * dist, Math.cos(PITCH) * dist);
    camera.lookAt(0, -0.22, 0);
    invalidate();
  }, [get, width, height]);
  return null;
}

/* ---------------------------------------------------------------- wrapper */

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* A flat silhouette for when there is no WebGL: water disc, island, one palm. */
export function IslandFallback({ onShown }: { onShown?: () => void }) {
  useEffect(() => onShown?.(), [onShown]);
  return (
    <svg viewBox="0 0 200 160" className="island-fallback" fill="none">
      <ellipse cx="100" cy="98" rx="74" ry="26" fill="#2fd3c0" fillOpacity="0.22" stroke="#8fd8ff" strokeOpacity="0.5" />
      <ellipse cx="100" cy="98" rx="56" ry="19" stroke="#ff6a4d" strokeOpacity="0.45" strokeDasharray="6 5" />
      <path d="M70 98c4-10 18-15 32-15s26 5 30 15c-8 4-20 6-31 6s-24-2-31-6z" fill="#eee6d3" fillOpacity="0.85" />
      <path d="M80 95c6-7 15-10 23-10s16 3 21 10c-7 2-14 3-22 3s-16-1-22-3z" fill="#3e9a62" />
      <path d="M96 88c1-10 3-18 8-25" stroke="#a3805a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M104 63c-8-3-15 0-19 5m19-5c7-4 14-3 19 1m-19-1c-2 6-1 11 2 15m-2-15c5 3 8 8 8 13" stroke="#3fae6a" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="124" cy="80" r="2.4" fill="#ffc27a" />
    </svg>
  );
}

class GLBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function IslandScene({ onReady }: { onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);
  const [webgl] = useState(hasWebGL);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  /* The fallback also counts as "ready", so the stage fades it in. */
  const fallback = <IslandFallback onShown={onReady} />;
  return (
    <div ref={ref} className="absolute inset-0">
      {webgl ? (
        <GLBoundary fallback={fallback}>
          <Canvas
            dpr={[1, 2]}
            frameloop={reduced ? "demand" : inView && pageVisible ? "always" : "never"}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping }}
            camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 4, 8] }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
              requestAnimationFrame(() => onReady?.());
            }}
            style={{ pointerEvents: "none" }}
          >
            <Rig />
            <Diorama reduced={reduced} />
          </Canvas>
        </GLBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
