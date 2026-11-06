// Original 15 s soundtrack for the Finrival video ad, synthesised from scratch, so there is
// no licence, attribution or Content ID claim attached to it.
//
//   node _video/music.mjs   -> _video/music.wav (48 kHz, 16-bit stereo)
//
// 80 BPM in A minor: one bar is exactly 3 s, so every scene change in ad-pl.html lands on a
// downbeat. Bar 1 intro (Am9), 2 Rynek (Fmaj7), 3 Porównaj (Cmaj7), 4 AI (Gadd9), 5 outro (Am add9).
// Each part is rendered as its own stem and levelled to a target loudness, then summed.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const DUR = 15;
const N = SR * DUR;
const BEAT = 60 / 80;
const S16 = BEAT / 4;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;

let seed = 20261106;
const noise = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;

const stem = (send = 0) => ({ L: new Float32Array(N), R: new Float32Array(N), send });
const put = (s, i, v, pan = 0) => {
  if (i < 0 || i >= N) return;
  const a = ((pan + 1) * Math.PI) / 4;
  s.L[i] += v * Math.cos(a);
  s.R[i] += v * Math.sin(a);
};

class SVF {
  l = 0;
  b = 0;
  run(x, fc, damp) {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6.5)) / SR);
    const h = x - this.l - damp * this.b;
    this.b += f * h;
    this.l += f * this.b;
    return { lp: this.l, bp: this.b, hp: h };
  }
}

// ---------- Chords ----------
const chords = [
  { t0: 0, t1: 3, notes: [57, 60, 64, 67, 71], atk: 1.6 },
  { t0: 3, t1: 6, notes: [53, 57, 60, 64, 69], atk: 0.2 },
  { t0: 6, t1: 9, notes: [52, 55, 60, 64, 71], atk: 0.2 },
  { t0: 9, t1: 12, notes: [55, 59, 62, 67, 69], atk: 0.2 },
  { t0: 12, t1: 15, notes: [45, 57, 60, 64, 71, 76], atk: 0.12 },
];
const bars = [
  { t0: 3, root: 41, arp: [65, 69, 72, 76, 81] },
  { t0: 6, root: 36, arp: [64, 67, 72, 76, 79] },
  { t0: 9, root: 43, arp: [67, 71, 74, 79, 81] },
];

// ---------- Pad: detuned saws through a moving low-pass ----------
const pad = stem(0.45);
{
  const rawL = new Float32Array(N);
  const rawR = new Float32Array(N);
  const voices = [
    { c: -9, pan: -0.75 },
    { c: 0, pan: 0 },
    { c: 9, pan: 0.75 },
  ];
  for (const ch of chords) {
    const rel = ch.t1 >= DUR ? 0 : 0.7;
    const i0 = Math.round(ch.t0 * SR);
    const i1 = Math.min(N, Math.round((ch.t1 + rel) * SR));
    for (const m of ch.notes) {
      for (const v of voices) {
        const f = mtof(m) * 2 ** (v.c / 1200);
        let ph = noise() * 0.5 + 0.5;
        const a = ((v.pan + 1) * Math.PI) / 4;
        for (let i = i0; i < i1; i++) {
          const t = i / SR - ch.t0;
          let env = Math.min(1, t / ch.atk);
          env = env * env * (3 - 2 * env);
          if (i / SR > ch.t1) env *= Math.max(0, 1 - (i / SR - ch.t1) / rel);
          ph += f / SR;
          if (ph >= 1) ph -= 1;
          const x = (2 * ph - 1) * env;
          rawL[i] += x * Math.cos(a);
          rawR[i] += x * Math.sin(a);
        }
      }
    }
  }
  const cut = (t) =>
    t < 3 ? 220 + 1300 * (t / 3) ** 2
    : t < 9 ? 1500 + 300 * Math.sin(((t - 3) / 6) * Math.PI)
    : t < 12 ? 1500 + ((t - 9) / 3) * 1300
    : 2800 - ((t - 12) / 3) * 1700;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < N; i++) {
    const fc = cut(i / SR);
    pad.L[i] = fl.run(rawL[i], fc, 0.9).lp;
    pad.R[i] = fr.run(rawR[i], fc, 0.9).lp;
  }
}

// ---------- Plucks: 16th-note arpeggio in bars 2-4, plus the intro word hits ----------
const pluckNote = (s, t0, m, len, pan, gain = 1) => {
  const f = mtof(m);
  const i0 = Math.round(t0 * SR);
  let p1 = 0;
  let p2 = 0;
  for (let k = 0; k < len * SR; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.003) * Math.exp(-t / (len / 4));
    p1 += f / SR;
    p2 += (2 * f) / SR;
    const tri = 1 - 4 * Math.abs((p1 % 1) - 0.5);
    put(s, i0 + k, (tri * 0.8 + Math.sin(TAU * p2) * 0.25) * env * gain, pan);
  }
};
const arp = stem(0.55);
{
  const pattern = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 1, 3, 4, 3];
  bars.forEach((b, bi) => {
    for (let k = 0; k < 16; k++) {
      const accent = k % 4 === 0 ? 1 : 0.62;
      pluckNote(arp, b.t0 + k * S16, b.arp[pattern[k]], 0.5, k % 2 ? 0.35 : -0.35, accent * (0.8 + bi * 0.12));
    }
  });
  // Brightness rises bar by bar
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const fc = t < 6 ? 1900 : t < 9 ? 2600 : 3800;
    arp.L[i] = fl.run(arp.L[i], fc, 1.1).lp;
    arp.R[i] = fr.run(arp.R[i], fc, 1.1).lp;
  }
}
const hits = stem(0.6);
pluckNote(hits, 0.65, 76, 1.6, -0.25);
pluckNote(hits, 0.85, 81, 1.6, 0.25);
pluckNote(hits, 1.3, 83, 1.8, 0);

// ---------- Bass: off-beat 8ths, saturated so it carries on phone speakers ----------
const bass = stem(0.03);
const bassNote = (t0, m, len, gain = 1) => {
  const f = mtof(m);
  const i0 = Math.round(t0 * SR);
  let p = 0;
  for (let k = 0; k < len * SR; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.006) * Math.exp(-t / (len / 3));
    p += f / SR;
    const x = Math.tanh(1.8 * (Math.sin(TAU * p) + 0.35 * Math.sin(2 * TAU * p))) * env * gain;
    put(bass, i0 + k, x, 0);
  }
};
for (const b of bars) {
  for (let j = 0; j < 4; j++) bassNote(b.t0 + j * BEAT + BEAT / 2, b.root, 0.34);
  bassNote(b.t0 + 3 * BEAT + BEAT * 0.75, b.root + 12, 0.16, 0.6);
}
bassNote(12, 33, 3.0, 1.1);

// ---------- Drums ----------
const kicks = [];
for (let t = 3; t < 11.99; t += BEAT) kicks.push(t);
const kick = stem(0.04);
for (const t0 of kicks) {
  const i0 = Math.round(t0 * SR);
  let p = 0;
  for (let k = 0; k < 0.45 * SR; k++) {
    const t = k / SR;
    p += (46 + 95 * Math.exp(-t / 0.028)) / SR;
    const x = Math.sin(TAU * p) * Math.exp(-t / 0.26) + noise() * Math.exp(-t / 0.002) * 0.25;
    put(kick, i0 + k, x, 0);
  }
}
const hats = stem(0.12);
{
  const hit = (t0, gain, pan) => {
    const i0 = Math.round(t0 * SR);
    const f = new SVF();
    for (let k = 0; k < 0.08 * SR; k++) {
      const t = k / SR;
      put(hats, i0 + k, f.run(noise(), 7500, 0.6).hp * Math.exp(-t / 0.028) * gain, pan);
    }
  };
  for (let t = 3 + BEAT / 2; t < 12; t += BEAT) hit(t, 1, 0.2);
  for (let t = 9 + S16; t < 12; t += 2 * S16) if (Math.abs(((t - 9) / BEAT) % 1 - 0.5) > 0.01) hit(t, 0.35, -0.3);
}
const snap = stem(0.35);
for (const t0 of [6 + BEAT, 6 + 3 * BEAT, 9 + BEAT, 9 + 3 * BEAT]) {
  const i0 = Math.round(t0 * SR);
  const f = new SVF();
  let p = 0;
  for (let k = 0; k < 0.25 * SR; k++) {
    const t = k / SR;
    p += 190 / SR;
    const x = f.run(noise(), 1900, 0.7).bp * Math.exp(-t / 0.075) + Math.sin(TAU * p) * Math.exp(-t / 0.03) * 0.4;
    put(snap, i0 + k, x, 0);
  }
}

// ---------- Transitions: risers, impacts, swipes, typing ----------
const fx = stem(0.4);
const riser = (t0, t1) => {
  const f = new SVF();
  for (let i = Math.round(t0 * SR); i < t1 * SR; i++) {
    const u = (i / SR - t0) / (t1 - t0);
    const fc = 350 * (8000 / 350) ** u;
    const env = u * u * Math.min(1, (t1 - i / SR) / 0.01);
    put(fx, i, f.run(noise(), fc, 0.35).lp * env, Math.sin(u * 9) * 0.4);
  }
};
riser(1.55, 3.0);
riser(10.75, 12.0);
const impacts = [3.0, 12.0];
const boom = stem(0.45);
for (const t0 of impacts) {
  const i0 = Math.round(t0 * SR);
  const f = new SVF();
  let p = 0;
  for (let k = 0; k < 2.0 * SR; k++) {
    const t = k / SR;
    p += (32 + 50 * Math.exp(-t / 0.12)) / SR;
    const x = Math.sin(TAU * p) * Math.exp(-t / 0.55) + f.run(noise(), 1400, 0.8).lp * Math.exp(-t / 0.35) * 0.6;
    put(boom, i0 + k, x, 0);
  }
}
const swipe = stem(0.3);
for (const tc of [5.95, 9.05, 12.0 - 0.15]) {
  const len = 0.42;
  const t0 = tc - len * 0.6;
  const f = new SVF();
  for (let k = 0; k < len * SR; k++) {
    const u = k / SR / len;
    const fc = 700 * (5200 / 700) ** u;
    put(swipe, Math.round(t0 * SR) + k, f.run(noise(), fc, 0.5).bp * Math.sin(Math.PI * u) ** 2, (u - 0.5) * 1.2);
  }
}
const typing = stem(0.1);
for (let s = 0; s < 23; s++) {
  const t0 = 10.25 + (s * 1.25) / 23 + noise() * 0.008;
  const f = new SVF();
  for (let k = 0; k < 0.03 * SR; k++) {
    const t = k / SR;
    put(typing, Math.round(t0 * SR) + k, f.run(noise(), 3200 + noise() * 600, 0.5).bp * Math.exp(-t / 0.006), -0.35);
  }
}

// ---------- Sound logo: three FM bell notes as the call to action lands ----------
const bells = stem(0.6);
[[12.45, 76, -0.2], [12.72, 81, 0.2], [13.05, 88, 0]].forEach(([t0, m, pan]) => {
  const f = mtof(m);
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < 2.6 * SR; k++) {
    const t = k / SR;
    const idx = 2.2 * Math.exp(-t / 0.35);
    const x = Math.sin(TAU * f * t + idx * Math.sin(TAU * f * 3.5 * t)) * Math.exp(-t / 0.9) * Math.min(1, t / 0.002);
    put(bells, i0 + k, x, pan);
  }
});

// ---------- Level each stem to a target, then sidechain to the kick ----------
const levels = { pad: -17, arp: -25, hits: -22, bass: -20, kick: -15, hats: -31, snap: -27, fx: -27, boom: -16, swipe: -30, typing: -36, bells: -21 };
const stems = { pad, arp, hits, bass, kick, hats, snap, fx, boom, swipe, typing, bells };
for (const [name, s] of Object.entries(stems)) {
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(s.L[i]), Math.abs(s.R[i]));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.abs(s.L[i]) + Math.abs(s.R[i]);
    if (a > peak * 0.02) {
      sum += s.L[i] ** 2 + s.R[i] ** 2;
      n += 2;
    }
  }
  const g = 10 ** (levels[name] / 20) / Math.sqrt(sum / n);
  for (let i = 0; i < N; i++) {
    s.L[i] *= g;
    s.R[i] *= g;
  }
}
const duck = new Float32Array(N).fill(1);
for (const [times, depth, rel] of [[kicks, 0.42, 0.13], [impacts, 0.7, 0.5]]) {
  for (const t0 of times) {
    for (let k = 0; k < rel * 6 * SR; k++) {
      const i = Math.round(t0 * SR) + k;
      if (i < N) duck[i] = Math.min(duck[i], 1 - depth * Math.exp(-k / SR / rel));
    }
  }
}
for (const s of [pad, arp, bass]) {
  for (let i = 0; i < N; i++) {
    s.L[i] *= duck[i];
    s.R[i] *= duck[i];
  }
}

// ---------- Mix, reverb, master ----------
const L = new Float32Array(N);
const R = new Float32Array(N);
const send = new Float32Array(N);
for (const s of Object.values(stems)) {
  for (let i = 0; i < N; i++) {
    L[i] += s.L[i];
    R[i] += s.R[i];
    send[i] += (s.L[i] + s.R[i]) * 0.5 * s.send;
  }
}
const freeverb = (input, spread) => {
  const sc = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * sc)), i: 0, z: 0 }));
  const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * sc)), i: 0 }));
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = input[n] * 0.02;
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.z = y * 0.7 + c.z * 0.3;
      c.buf[c.i] = x + c.z * 0.87;
      if (++c.i >= c.buf.length) c.i = 0;
      s += y;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = s + b * 0.5;
      if (++a.i >= a.buf.length) a.i = 0;
      s = b - s;
    }
    out[n] = s;
  }
  return out;
};
const wl = freeverb(send, 0);
const wr = freeverb(send, 23);
const rms = (...bufs) => Math.sqrt(bufs.reduce((acc, b) => acc + b.reduce((x, v) => x + v * v, 0), 0) / (bufs.length * N));
const wetGain = (0.32 * rms(L, R)) / rms(wl, wr);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = t > 13.8 ? 0.5 + 0.5 * Math.cos((Math.PI * (t - 13.8)) / (DUR - 13.8)) : 1;
  L[i] = (L[i] + wl[i] * wetGain) * fade;
  R[i] = (R[i] + wr[i] * wetGain) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}

const wav = Buffer.alloc(44 + N * 4);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + N * 4, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(N * 4, 40);
const g = 0.89 / peak;
for (let i = 0; i < N; i++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
}
const out = join(here, "music.wav");
writeFileSync(out, wav);
console.log(out);
