"use client";

import { useSyncExternalStore } from "react";

/*
 * Atol's sound: small, warm and wet, like the island it lives on. Nothing is
 * a file; every sound is synthesised on the fly with the Web Audio API from
 * three voices:
 *
 *   tine   a kalimba-like pluck: a sine fundamental, a soft octave and a
 *          short inharmonic "wood" partial that is only there in the attack.
 *   drop   a water droplet: a sine whose pitch glides up (or down) fast.
 *   breeze filtered noise that swells and fades, a page turning in the wind.
 *
 * Notes come from D major pentatonic, so any two sounds that overlap still
 * agree. Everything goes through one quiet master bus with a short generated
 * room (convolver), a gentle low-pass and a soft compressor, so nothing is
 * ever sharp or loud.
 *
 * Browsers only allow audio after a gesture: the context is created on the
 * first pointerdown or keydown. `welcome` is played only when the context is
 * already awake (arriving from the login, not on a cold page load).
 *
 * Notas ("Luz") is the sky above the clouds at golden hour: three voices.
 *
 *   harp   a plucked string: a bright attack that mellows as a low-pass
 *          closes on it, with a soft octave.
 *   chirp  a small bird: a sine flicking up and back, twice.
 *   aah    a far-off choir: a sawtooth through two vowel formants, slow to
 *          swell, for the light itself.
 *
 * Its notes come from A major pentatonic. Only meaningful moments sound
 * (open, keep, release, delete, undo, pin); typing and hovering stay silent.
 *
 * Hábitos ("Lavanda") is a field at the blue hour, in the wind: two more
 * voices, airy and slow.
 *
 *   flute  a breathy sine with a soft second harmonic, a puff of band-passed
 *          noise in the attack and a vibrato that comes in late.
 *   chime  a wind chime: a pure tone with one faint inharmonic partial and a
 *          long tail, struck softly.
 *
 * Its notes come from G major pentatonic; marking the days of a week climbs
 * the scale (`step`), so a full week plays a little phrase. Holding the
 * "keep" button plays a gust of wind with a rising flute that can be cut
 * short (`holdTone`).
 *
 * The on/off preference lives in localStorage ("atol:sound"), on by default.
 */

export type SoundName =
  | "tap"
  | "open"
  | "close"
  | "toggle-on"
  | "toggle-off"
  | "swap"
  | "nope"
  | "error"
  | "success"
  | "sent"
  | "welcome"
  | "note-open"
  | "note-close"
  | "note-create"
  | "note-save"
  | "note-delete"
  | "note-undo"
  | "note-pin"
  | "note-unpin"
  | "hab-tick"
  | "hab-day"
  | "hab-day-off"
  | "hab-keep"
  | "hab-unkeep"
  | "hab-bloom"
  | "hab-create"
  | "hab-delete"
  | "hab-undo"
  | "hab-open"
  | "hab-close"
  | "hab-nope";

const STORAGE_KEY = "atol:sound";

/* D major pentatonic, Hz */
const N = {
  D3: 146.83,
  A3: 220,
  D4: 293.66,
  Fs4: 369.99,
  A4: 440,
  B4: 493.88,
  D5: 587.33,
  E5: 659.25,
  Fs5: 739.99,
  A5: 880,
  B5: 987.77,
  D6: 1174.66,
};

/* A major pentatonic: the golden hour's notes */
const L = {
  A3: 220,
  E4: 329.63,
  A4: 440,
  B4: 493.88,
  Cs5: 554.37,
  E5: 659.25,
  Fs5: 739.99,
  A5: 880,
  B5: 987.77,
  Cs6: 1108.73,
  E6: 1318.51,
};

/* G major pentatonic, warm: the dawn's notes */
const G = [196, 220, 246.94, 293.66, 329.63, 392, 440, 493.88, 587.33, 659.25, 783.99, 880];

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let room: GainNode | null = null;
let noise: AudioBuffer | null = null;
const lastPlayed = new Map<SoundName, number>();

/* A decaying stereo noise tail: a small, soft room. */
function impulse(ac: AudioContext, seconds: number, decay: number) {
  const length = Math.floor(ac.sampleRate * seconds);
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function wake(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 6000;
    tone.Q.value = 0.4;

    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.knee.value = 18;
    glue.ratio.value = 3;
    glue.attack.value = 0.004;
    glue.release.value = 0.25;

    bus = ctx.createGain();
    bus.gain.value = 0.2;
    bus.connect(tone).connect(glue).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 1.6, 3.4);
    room = ctx.createGain();
    room.gain.value = 0.28;
    room.connect(reverb).connect(tone);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/* Route a voice to the dry bus and, a little, to the room. */
function out(node: AudioNode, wet = 1) {
  node.connect(bus!);
  if (wet > 0) {
    const send = ctx!.createGain();
    send.gain.value = wet;
    node.connect(send).connect(room!);
  }
}

function envelope(at: number, peak: number, attack: number, decay: number) {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

function osc(type: OscillatorType, freq: number, at: number, stop: number, into: AudioNode) {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.connect(into);
  o.start(at);
  o.stop(stop);
  return o;
}

/* Kalimba-like pluck. */
function tine(freq: number, at: number, { gain = 0.5, decay = 0.9, wet = 1, dark = false } = {}) {
  const filter = ctx!.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = dark ? 1400 : 4200;
  out(filter, wet);

  const body = envelope(at, gain, 0.005, decay);
  body.connect(filter);
  osc("sine", freq, at, at + decay + 0.05, body);

  const octave = envelope(at, gain * 0.18, 0.004, decay * 0.45);
  octave.connect(filter);
  osc("sine", freq * 2, at, at + decay, octave);

  // The tine's "wood": an inharmonic partial gone in a few tens of ms.
  const wood = envelope(at, gain * (dark ? 0.08 : 0.14), 0.002, 0.05);
  wood.connect(filter);
  osc("triangle", freq * 5.4, at, at + 0.08, wood);
}

/* A water droplet: a short sine gliding between two pitches. */
function drop(from: number, to: number, at: number, { gain = 0.35, length = 0.16 } = {}) {
  const g = envelope(at, gain, 0.004, length);
  out(g, 0.8);
  const o = osc("sine", from, at, at + length + 0.05, g);
  o.frequency.exponentialRampToValueAtTime(to, at + length * 0.45);
}

/* Filtered noise that swells and fades. */
function breeze(at: number, { gain = 0.08, length = 0.32, from = 900, to = 2600 } = {}) {
  const src = ctx!.createBufferSource();
  src.buffer = noise;
  const band = ctx!.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(from, at);
  band.frequency.exponentialRampToValueAtTime(to, at + length);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + length * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(band).connect(g);
  out(g, 0.6);
  src.start(at);
  src.stop(at + length + 0.02);
}

/* A slow, soft chord: triangle pads that bloom and fade. */
function bloom(freqs: number[], at: number, { gain = 0.07, attack = 0.45, decay = 2.2 } = {}) {
  const filter = ctx!.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(500, at);
  filter.frequency.linearRampToValueAtTime(2200, at + attack);
  out(filter, 1.2);
  freqs.forEach((f, i) => {
    const g = envelope(at, gain, attack, decay);
    g.connect(filter);
    // A hair of detune per voice keeps the chord alive.
    const o = osc("triangle", f, at, at + attack + decay + 0.1, g);
    o.detune.value = (i - 1) * 4;
  });
}

/* A plucked harp string: bright at the pluck, mellowing as it rings. */
function harp(freq: number, at: number, { gain = 0.14, decay = 1.6, wet = 1.2 } = {}) {
  const filter = ctx!.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.6;
  filter.frequency.setValueAtTime(freq * 8, at);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.6, at + 0.35);
  out(filter, wet);
  const body = envelope(at, gain, 0.003, decay);
  body.connect(filter);
  osc("triangle", freq, at, at + decay + 0.05, body);
  const octave = envelope(at, gain * 0.22, 0.003, decay * 0.5);
  octave.connect(filter);
  osc("sine", freq * 2, at, at + decay * 0.5 + 0.05, octave);
}

/* A small bird: a sine flicking up and back down, twice. */
function chirp(at: number, { gain = 0.04, base = 2600 } = {}) {
  [0, 0.09].forEach((d, i) => {
    const t = at + d;
    const g = envelope(t, gain * (1 - i * 0.3), 0.004, 0.06);
    out(g, 0.7);
    const o = osc("sine", base, t, t + 0.09, g);
    o.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.025);
    o.frequency.exponentialRampToValueAtTime(base * 1.1, t + 0.06);
  });
}

/* A far-off choir on "aah": a sawtooth through two vowel formants. */
function aah(freqs: number[], at: number, { gain = 0.05, attack = 0.5, decay = 1.8 } = {}) {
  const f1 = ctx!.createBiquadFilter();
  f1.type = "bandpass";
  f1.frequency.value = 760;
  f1.Q.value = 5;
  const f2 = ctx!.createBiquadFilter();
  f2.type = "bandpass";
  f2.frequency.value = 1150;
  f2.Q.value = 6;
  const mix = ctx!.createGain();
  mix.gain.value = 2.2;
  f1.connect(mix);
  f2.connect(mix);
  out(mix, 1.6);
  freqs.forEach((f, i) => {
    const g = envelope(at, gain, attack, decay);
    g.connect(f1);
    g.connect(f2);
    osc("sawtooth", f, at, at + attack + decay + 0.1, g).detune.value = (i - 1) * 5;
  });
}

/* A paper sound: a few ms of bright noise. */
function paper(at: number, { gain = 0.08, length = 0.04, freq = 4200, q = 1.4 } = {}) {
  const src = ctx!.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.5;
  const band = ctx!.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = q;
  const g = envelope(at, gain, 0.002, length);
  src.connect(band).connect(g);
  out(g, 0.35);
  // Start somewhere random in the buffer so two ticks never sound alike.
  src.start(at, Math.random() * 0.8);
  src.stop(at + length + 0.03);
}

/* A breathy flute: a puff of air, then the tone, then a late vibrato. */
function flute(freq: number, at: number, { gain = 0.16, length = 0.7, wet = 1.1 } = {}) {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.06);
  g.gain.setValueAtTime(gain, at + length * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  const tone = ctx!.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = freq * 3;
  g.connect(tone);
  out(tone, wet);

  const vib = ctx!.createOscillator();
  vib.frequency.value = 5.2;
  const depth = ctx!.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(freq * 0.006, at + length * 0.6);
  vib.connect(depth);
  vib.start(at);
  vib.stop(at + length + 0.05);

  const body = osc("sine", freq, at, at + length + 0.05, g);
  depth.connect(body.frequency);
  const second = ctx!.createGain();
  second.gain.value = 0.12;
  second.connect(g);
  const o2 = osc("sine", freq * 2, at, at + length + 0.05, second);
  depth.connect(o2.frequency);

  breeze(at, { gain: gain * 0.35, length: 0.12, from: freq * 2, to: freq * 3 });
}

/* A wind chime, struck softly. */
function chime(freq: number, at: number, { gain = 0.1, decay = 1.8, wet = 1.3 } = {}) {
  const g = envelope(at, gain, 0.004, decay);
  out(g, wet);
  osc("sine", freq, at, at + decay + 0.05, g);
  const shimmer = envelope(at, gain * 0.25, 0.003, decay * 0.3);
  out(shimmer, wet);
  osc("sine", freq * 2.76, at, at + decay * 0.3 + 0.05, shimmer);
}

const SOUNDS: Record<SoundName, (t: number, step: number) => void> = {
  tap: (t) => tine(N.D6, t, { gain: 0.12, decay: 0.12, wet: 0.3 }),
  open: (t) => {
    drop(520, 1150, t, { gain: 0.3 });
    tine(N.A5, t + 0.05, { gain: 0.14, decay: 0.5 });
  },
  close: (t) => drop(980, 470, t, { gain: 0.2, length: 0.13 }),
  "toggle-on": (t) => {
    tine(N.D5, t, { gain: 0.28, decay: 0.35 });
    tine(N.A5, t + 0.07, { gain: 0.24, decay: 0.55 });
  },
  "toggle-off": (t) => {
    tine(N.A5, t, { gain: 0.22, decay: 0.3 });
    tine(N.D5, t + 0.07, { gain: 0.2, decay: 0.45, dark: true });
  },
  swap: (t) => {
    breeze(t, { gain: 0.07 });
    tine(N.Fs5, t + 0.08, { gain: 0.2, decay: 0.7 });
  },
  nope: (t) => tine(N.A3, t, { gain: 0.3, decay: 0.22, wet: 0.4, dark: true }),
  error: (t) => {
    tine(N.Fs4, t, { gain: 0.32, decay: 0.32, dark: true });
    tine(N.D4, t + 0.12, { gain: 0.3, decay: 0.55, dark: true });
  },
  success: (t) => {
    [N.D5, N.Fs5, N.A5, N.D6].forEach((f, i) =>
      tine(f, t + i * 0.075, { gain: 0.3 - i * 0.03, decay: 1.1 + i * 0.15 }),
    );
    drop(700, 1500, t + 0.3, { gain: 0.12 });
  },
  sent: (t) => {
    tine(N.E5, t, { gain: 0.26, decay: 0.6 });
    tine(N.A5, t + 0.1, { gain: 0.24, decay: 1 });
  },
  welcome: (t) => {
    bloom([N.D3, N.A3, N.Fs4], t);
    tine(N.A5, t + 0.25, { gain: 0.16, decay: 1.4 });
    tine(N.D6, t + 0.42, { gain: 0.13, decay: 1.6 });
    drop(600, 1300, t + 0.7, { gain: 0.1 });
  },

  /* ---------- Notas ---------- */
  "note-open": (t) => {
    breeze(t, { gain: 0.04, length: 0.4, from: 600, to: 2200 });
    harp(L.E5, t + 0.02, { gain: 0.1, decay: 1.2 });
    harp(L.A5, t + 0.09, { gain: 0.08, decay: 1.5 });
  },
  "note-close": (t) => {
    breeze(t, { gain: 0.03, length: 0.28, from: 1800, to: 600 });
    harp(L.Cs5, t + 0.02, { gain: 0.07, decay: 0.8 });
  },
  "note-save": (t) => {
    harp(L.A4, t, { gain: 0.09, decay: 1.2 });
    harp(L.E5, t + 0.07, { gain: 0.08, decay: 1.6 });
  },
  // The note is let go: a harp run upward, the light swells, two birds take off.
  "note-create": (t) => {
    [L.A4, L.Cs5, L.E5, L.Fs5, L.A5, L.Cs6, L.E6].forEach((f, i) =>
      harp(f, t + i * 0.045, { gain: 0.1 - i * 0.008, decay: 1.4 + i * 0.15 }),
    );
    aah([L.A3, L.E4, L.Cs5], t + 0.05, { gain: 0.035, attack: 0.4, decay: 1.6 });
    chirp(t + 0.42, { base: 2800 });
    chirp(t + 0.6, { gain: 0.03, base: 3300 });
  },
  "note-delete": (t) => {
    breeze(t, { gain: 0.05, length: 0.5, from: 1600, to: 300 });
    harp(L.B4, t + 0.02, { gain: 0.06, decay: 0.5 });
    harp(L.E4, t + 0.1, { gain: 0.07, decay: 0.9 });
  },
  "note-undo": (t) => {
    harp(L.E5, t, { gain: 0.07, decay: 0.5 });
    harp(L.A5, t + 0.06, { gain: 0.08, decay: 0.7 });
    harp(L.Cs6, t + 0.12, { gain: 0.08, decay: 1.2 });
  },
  // Near the sun: a high pluck and the light answering.
  "note-pin": (t) => {
    harp(L.B5, t, { gain: 0.08, decay: 1 });
    harp(L.E6, t + 0.06, { gain: 0.07, decay: 1.5 });
    aah([L.E4, L.B4], t + 0.04, { gain: 0.025, attack: 0.25, decay: 1.1 });
  },
  "note-unpin": (t) => harp(L.Fs5, t, { gain: 0.07, decay: 0.7 }),

  /* ---------- Hábitos ---------- */
  "hab-tick": (t) => chime(G[10], t, { gain: 0.035, decay: 0.35, wet: 0.6 }),
  "hab-day": (t, step) => {
    flute(G[Math.min(4 + step, G.length - 1)], t, { gain: 0.13, length: 0.55 });
    chime(G[Math.min(6 + step, G.length - 1)] * 2, t + 0.04, { gain: 0.03, decay: 1 });
  },
  "hab-day-off": (t) => flute(G[1], t, { gain: 0.1, length: 0.32, wet: 0.5 }),
  "hab-keep": (t) => {
    breeze(t, { gain: 0.06, length: 0.7, from: 600, to: 2600 });
    flute(G[5], t + 0.02, { gain: 0.14, length: 0.9 });
    [G[8], G[10], G[11]].forEach((f, i) => chime(f * 2, t + 0.1 + i * 0.09, { gain: 0.05 - i * 0.01, decay: 1.6 + i * 0.4 }));
  },
  "hab-unkeep": (t) => {
    flute(G[6], t, { gain: 0.1, length: 0.3 });
    flute(G[3], t + 0.12, { gain: 0.1, length: 0.5, wet: 0.6 });
  },
  "hab-bloom": (t) => {
    bloom([G[0], G[3], G[7]], t, { gain: 0.07, attack: 0.8, decay: 3 });
    breeze(t, { gain: 0.07, length: 1.4, from: 400, to: 3200 });
    [G[5], G[7], G[8], G[10]].forEach((f, i) => flute(f, t + 0.15 + i * 0.16, { gain: 0.11, length: 0.7 + i * 0.25 }));
    [G[10], G[11]].forEach((f, i) => chime(f * 2, t + 0.9 + i * 0.12, { gain: 0.04, decay: 2.4 }));
  },
  "hab-create": (t) => {
    breeze(t, { gain: 0.05, length: 0.5, from: 500, to: 2200 });
    flute(G[5], t + 0.05, { gain: 0.12, length: 0.45 });
    flute(G[7], t + 0.2, { gain: 0.12, length: 0.7 });
    chime(G[10] * 2, t + 0.3, { gain: 0.04, decay: 1.8 });
  },
  "hab-delete": (t) => {
    breeze(t, { gain: 0.06, length: 0.5, from: 2200, to: 400 });
    flute(G[4], t + 0.02, { gain: 0.1, length: 0.3 });
    flute(G[0], t + 0.16, { gain: 0.11, length: 0.6, wet: 0.6 });
  },
  "hab-undo": (t) => {
    flute(G[3], t, { gain: 0.1, length: 0.28 });
    flute(G[5], t + 0.12, { gain: 0.11, length: 0.55 });
  },
  "hab-open": (t) => {
    breeze(t, { gain: 0.045, length: 0.35, from: 700, to: 2600 });
    chime(G[9] * 2, t + 0.05, { gain: 0.04, decay: 0.9 });
  },
  "hab-close": (t) => chime(G[7] * 2, t, { gain: 0.035, decay: 0.6, wet: 0.8 }),
  "hab-nope": (t) => {
    flute(G[1], t, { gain: 0.1, length: 0.18, wet: 0.4 });
    flute(G[0], t + 0.12, { gain: 0.1, length: 0.3, wet: 0.4 });
  },
};

/* ---------- preference ---------- */

const listeners = new Set<() => void>();
let enabled: boolean | null = null;

function readEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function isSoundOn() {
  if (enabled === null) enabled = typeof window === "undefined" ? true : readEnabled();
  return enabled;
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private mode: the choice lasts for this session only.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether sounds are on, kept in sync across components. */
export function useSoundOn() {
  return useSyncExternalStore(subscribe, isSoundOn, () => true);
}

/* ---------- playing ---------- */

/**
 * Play one of Atol's sounds. `onlyIfAwake` skips it unless audio was already
 * unlocked by a gesture on this page (no surprise sound on a cold load).
 */
export function playSound(name: SoundName, { onlyIfAwake = false, step = 0 } = {}) {
  if (typeof window === "undefined" || !isSoundOn() || document.hidden) return;
  if (onlyIfAwake && (!ctx || ctx.state !== "running")) return;
  const ac = wake();
  if (!ac) return;

  // The same sound twice within 50ms is one sound.
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < 50) return;
  lastPlayed.set(name, now);

  SOUNDS[name](ac.currentTime + 0.01, step);
}

/**
 * The gust under a press-and-hold: wind swelling through the grass with a
 * soft flute gliding up an octave over `ms`. Returns `stop`, which
 * fades it out early (the hold was let go) or lets it finish (`done`).
 */
export function holdTone(ms: number): (done?: boolean) => void {
  if (typeof window === "undefined" || !isSoundOn() || document.hidden) return () => {};
  const ac = wake();
  if (!ac) return () => {};
  const at = ac.currentTime + 0.01;
  const length = ms / 1000;

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, at);
  filter.frequency.exponentialRampToValueAtTime(2600, at + length);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.11, at + length * 0.8);
  filter.connect(g);
  out(g, 0.9);

  const voices = [G[0], G[2] * 1.002].map((f) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * 2, at + length);
    o.connect(filter);
    o.start(at);
    return o;
  });

  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(500, at);
  band.frequency.exponentialRampToValueAtTime(3000, at + length);
  const air = ac.createGain();
  air.gain.setValueAtTime(0, at);
  air.gain.linearRampToValueAtTime(0.09, at + length);
  src.connect(band).connect(air);
  out(air, 0.6);
  src.start(at);

  let stopped = false;
  return (done = false) => {
    if (stopped) return;
    stopped = true;
    const now = ac.currentTime;
    const fade = done ? 0.05 : 0.12;
    for (const node of [g.gain, air.gain]) {
      node.cancelScheduledValues(now);
      node.setValueAtTime(node.value, now);
      node.linearRampToValueAtTime(0, now + fade);
    }
    [...voices, src].forEach((o) => o.stop(now + fade + 0.02));
  };
}

/* Unlock audio on the first gesture, so later sounds start on time. */
if (typeof window !== "undefined") {
  const unlock = () => {
    if (isSoundOn()) wake();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}
