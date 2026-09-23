#!/usr/bin/env node
/**
 * Renders the in-game background music to assets/music/bgm.wav.
 *
 * An original 4-channel chiptune (two pulse voices, triangle bass, noise drums) at 140 BPM,
 * 32 bars: verse → chorus → bridge → chorus. It is written to loop seamlessly: the last bar leads
 * back into the first, and the echo tail wraps around to the start.
 *
 *   node scripts/generate-music.js
 */
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const BPM = 140;
const STEP = 60 / BPM / 4; // one 16th note, seconds
const STEPS_PER_BAR = 16;

// ─── Notes ────────────────────────────────────────────────────────────────────

const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function freq(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  const midi = 12 * (Number(m[2]) + 1) + SEMI[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Chord name → triad (root position, octave 4). */
const CHORDS = {
  C: ['C4', 'E4', 'G4'],
  G: ['G3', 'B3', 'D4'],
  Am: ['A3', 'C4', 'E4'],
  F: ['F3', 'A3', 'C4'],
  Em: ['E3', 'G3', 'B3'],
  Dm: ['D4', 'F4', 'A4'],
};
const BASS_ROOT = { C: 'C2', G: 'G1', Am: 'A1', F: 'F1', Em: 'E2', Dm: 'D2' };

// ─── Song ─────────────────────────────────────────────────────────────────────
// Melody bars: 8 eighth notes; '-' holds the previous note, '.' is a rest.

const SECTIONS = {
  // Verse: bouncy, mid register
  A: {
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    drums: 'verse',
    melody: [
      'E5 . G5 E5 C5 . D5 E5',
      'D5 - B4 . G4 . B4 D5',
      'C5 . E5 C5 A4 . B4 C5',
      'A4 - C5 . F5 . E5 D5',
      'E5 . G5 E5 C6 . B5 G5',
      'A5 G5 F5 D5 B4 . D5 .',
      'C5 . A4 C5 F5 E5 D5 C5',
      'D5 - - . G4 A4 B4 D5',
    ],
  },
  // Chorus: higher, the hook
  B: {
    chords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
    drums: 'chorus',
    melody: [
      'A5 - G5 A5 . C6 A5 .',
      'G5 - F5 G5 . B5 G5 .',
      'E5 - D5 E5 G5 . E5 .',
      'A5 - - . C6 B5 A5 G5',
      'A5 - G5 A5 . C6 D6 .',
      'B5 - A5 B5 . D6 B5 .',
      'C6 - - . G5 E5 G5 .',
      'C6 . . . C5 D5 E5 G5',
    ],
  },
  // Bridge: calmer, then a snare roll back into the chorus
  C: {
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'],
    drums: 'bridge',
    melody: [
      'A4 - - C5 E5 - - C5',
      'F5 - - E5 C5 - A4 .',
      'G4 - - C5 E5 - G5 .',
      'D5 - - B4 G4 - - .',
      'A4 - C5 E5 A5 - G5 E5',
      'F5 - A5 F5 C5 - A4 C5',
      'D5 - G5 D5 B4 D5 G5 B5',
      'D6 - - - . . . .',
    ],
  },
};
const ORDER = ['A', 'B', 'C', 'B'];

// ─── Synthesis ────────────────────────────────────────────────────────────────

/** PolyBLEP correction so pulse waves don't alias harshly at 22 kHz. */
function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}
function pulse(phase, dt, duty) {
  let v = phase < duty ? 1 : -1;
  v += blep(phase, dt);
  v -= blep((phase + 1 - duty) % 1, dt);
  return v;
}
/** NES-style 4-bit stepped triangle. */
function triangle(phase) {
  const tri = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
  return Math.round(tri * 7.5) / 7.5;
}

const bars = ORDER.flatMap((name) => SECTIONS[name].chords.map((chord, i) => ({ name, chord, bar: i, sec: SECTIONS[name] })));
const totalSteps = bars.length * STEPS_PER_BAR;
const N = Math.round(totalSteps * STEP * RATE);
const lead = new Float32Array(N);
const mix = new Float32Array(N);

const at = (step) => Math.round(step * STEP * RATE);

/** One pulse note with attack/decay/release and delayed vibrato. */
function pulseNote(buf, start, lenSteps, f, { duty, vol, vibrato = true, decay = 0.6 }) {
  const s0 = at(start);
  const len = at(lenSteps);
  const rel = Math.round(0.03 * RATE);
  let phase = 0;
  for (let i = 0; i < len + rel && s0 + i < N; i++) {
    const t = i / RATE;
    const vib = vibrato && t > 0.15 ? 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * (t - 0.15)) : 1;
    const dt = (f * vib) / RATE;
    phase = (phase + dt) % 1;
    let env = Math.min(1, t / 0.005);
    env *= decay + (1 - decay) * Math.exp(-t / 0.08);
    if (i >= len) env *= 1 - (i - len) / rel;
    buf[s0 + i] += pulse(phase, dt, duty) * env * vol;
  }
}

function triNote(start, lenSteps, f, vol) {
  const s0 = at(start);
  const len = at(lenSteps) - Math.round(0.01 * RATE);
  // Start at the zero crossing and fade in/out briefly so notes don't click
  let phase = 0.25;
  for (let i = 0; i < len && s0 + i < N; i++) {
    phase = (phase + f / RATE) % 1;
    const edge = Math.min(1, i / (0.003 * RATE), (len - i) / (0.004 * RATE));
    mix[s0 + i] += triangle(phase) * vol * edge;
  }
}

// Noise from a 15-bit LFSR like the NES noise channel
let lfsr = 1;
function noiseSample() {
  const bit = (lfsr ^ (lfsr >> 1)) & 1;
  lfsr = (lfsr >> 1) | (bit << 14);
  return lfsr & 1 ? 1 : -1;
}

function kick(step, vol) {
  const s0 = at(step);
  let phase = 0;
  for (let i = 0; i < 0.14 * RATE && s0 + i < N; i++) {
    const t = i / RATE;
    const f = 45 + 110 * Math.exp(-t / 0.025);
    phase += f / RATE;
    mix[s0 + i] += Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.05) * vol;
  }
}
function snare(step, vol) {
  const s0 = at(step);
  let phase = 0;
  for (let i = 0; i < 0.16 * RATE && s0 + i < N; i++) {
    const t = i / RATE;
    phase += 185 / RATE;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.03) * 0.5;
    mix[s0 + i] += (noiseSample() * Math.exp(-t / 0.045) + body) * vol;
  }
}
function hat(step, vol) {
  const s0 = at(step);
  let prev = 0;
  for (let i = 0; i < 0.035 * RATE && s0 + i < N; i++) {
    const n = noiseSample();
    // First difference = crude high-pass so hats sound thin and bright
    mix[s0 + i] += (n - prev) * 0.5 * Math.exp(-(i / RATE) / 0.012) * vol;
    prev = n;
  }
}

// ─── Arrange ──────────────────────────────────────────────────────────────────

bars.forEach(({ chord, bar, sec }, barIndex) => {
  const base = barIndex * STEPS_PER_BAR;
  const chorus = sec.drums === 'chorus';
  const bridge = sec.drums === 'bridge';

  // Lead melody (eighth notes; ties extend the previous note)
  const tokens = sec.melody[bar].split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === '-' || tok === '.') continue;
    let len = 1;
    while (i + len < tokens.length && tokens[i + len] === '-') len++;
    pulseNote(lead, base + i * 2, len * 2 - 0.3, freq(tok), {
      duty: chorus ? 0.25 : 0.5,
      vol: bridge ? 0.18 : 0.22,
    });
  }

  // Arpeggio: chord tones cycling every 16th (every 8th in the bridge)
  const tones = [...CHORDS[chord], CHORDS[chord][0].replace(/\d/, (d) => String(Number(d) + 1))];
  const arpStep = bridge ? 2 : 1;
  for (let s = 0; s < STEPS_PER_BAR; s += arpStep) {
    const note = tones[(s / arpStep) % tones.length];
    pulseNote(mix, base + s, arpStep * 0.8, freq(note) * 2, { duty: 0.125, vol: chorus ? 0.075 : 0.06, vibrato: false, decay: 0.3 });
  }

  // Triangle bass: octave bounce on 8ths, a walk up to the fifth in the chorus
  const root = freq(BASS_ROOT[chord]);
  for (let e = 0; e < 8; e++) {
    let f = e % 2 === 0 ? root : root * 2;
    if (chorus && e === 7) f = root * 1.5;
    if (bridge && e % 2 === 1) f = root * 1.5;
    triNote(base + e * 2, 2, f, 0.3);
  }

  // Drums
  if (sec.drums === 'verse') {
    [0, 8].forEach((s) => kick(base + s, 0.42));
    [4, 12].forEach((s) => snare(base + s, 0.2));
    for (let s = 0; s < 16; s += 2) hat(base + s, 0.09);
  } else if (chorus) {
    [0, 6, 8, 10].forEach((s) => kick(base + s, 0.42));
    [4, 12].forEach((s) => snare(base + s, 0.22));
    for (let s = 0; s < 16; s++) hat(base + s, s % 2 ? 0.05 : 0.1);
  } else {
    kick(base, 0.38);
    if (bar === 3 || bar === 7) kick(base + 8, 0.38);
    if (bar < 7) {
      snare(base + 12, 0.16);
      for (let s = 0; s < 16; s += 4) hat(base + s, 0.08);
    } else {
      // Build back into the chorus
      for (let s = 8; s < 16; s++) snare(base + s, 0.08 + (s - 8) * 0.02);
    }
  }
});

// Lead echo (dotted 8th, circular so the tail wraps into the loop start)
const delay = at(3);
const echo = new Float32Array(N);
for (let pass = 0; pass < 2; pass++) {
  for (let i = 0; i < N; i++) {
    const j = (i - delay + N) % N;
    echo[i] = lead[i] + echo[j] * 0.28;
  }
}
for (let i = 0; i < N; i++) mix[i] += lead[i] + (echo[i] - lead[i]) * 0.6;

// Normalize to -1 dBFS with gentle soft clipping
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(mix[i]));
const gain = 0.89 / peak;

const data = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  const v = Math.tanh(mix[i] * gain * 1.1) / Math.tanh(1.1);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

const out = path.join(__dirname, '..', 'assets', 'music', 'bgm.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, data]));
console.log(`bgm.wav  ${(N / RATE).toFixed(1)} s  ${Math.round((44 + data.length) / 1024)} KB  (${bars.length} bars @ ${BPM} BPM)`);
