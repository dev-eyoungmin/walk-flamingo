// Procedural SFX generator — 22050 Hz, mono, 16-bit PCM WAV, base64 data URIs

const SAMPLE_RATE = 22050;

// ---------------------------------------------------------------------------
// WAV helpers
// ---------------------------------------------------------------------------

function writeWavHeader(view: DataView, dataSize: number): void {
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);        // fmt chunk size
  view.setUint16(20, 1, true);         // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
}

function samplesToBase64(samples: number[]): string {
  const dataSize = samples.length * 2; // 16-bit → 2 bytes per sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeWavHeader(view, dataSize);

  for (let i = 0; i < samples.length; i++) {
    // Clamp and convert to 16-bit signed PCM
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

// ---------------------------------------------------------------------------
// Primitive generators
// ---------------------------------------------------------------------------

function generateTone(
  freq: number,
  duration: number,
  decay: number,
  volume: number,
): number[] {
  const n = Math.floor(duration * SAMPLE_RATE);
  const samples: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * volume;
  }
  return samples;
}

function generateNoise(duration: number, decay: number, volume: number): number[] {
  const n = Math.floor(duration * SAMPLE_RATE);
  const samples: number[] = new Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const noise = Math.random() * 2 - 1;
    prev = prev * 0.8 + noise * 0.2; // low-pass filter
    const env = Math.exp(-decay * t);
    samples[i] = prev * env * volume;
  }
  return samples;
}

function mixSamples(...arrays: number[][]): number[] {
  const len = Math.max(...arrays.map((a) => a.length));
  const out: number[] = new Array(len).fill(0);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) {
      out[i] += arr[i];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Individual SFX generators
// ---------------------------------------------------------------------------

function genObstacleSwipe(): number[] {
  // White noise sweep: high-pass starts open, closes over 0.25s
  const n = Math.floor(0.25 * SAMPLE_RATE);
  const samples: number[] = new Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Alpha slides from near-0 (high-pass) toward 0.9 (low-pass) — perceived pitch drop
    const alpha = 0.05 + 0.85 * (t / 0.25);
    const noise = Math.random() * 2 - 1;
    prev = prev * alpha + noise * (1 - alpha);
    const env = Math.exp(-3 * t);
    samples[i] = prev * env * 0.7;
  }
  return samples;
}

function genObstacleHit(): number[] {
  const noise = generateNoise(0.3, 10, 0.6);
  const boom = generateTone(60, 0.3, 12, 0.5);
  return mixSamples(noise, boom);
}

function genWarningBeep(): number[] {
  // Two 880 Hz beeps: 0–0.08s, gap 0.08–0.14s, 0.14–0.22s
  const n = Math.floor(0.22 * SAMPLE_RATE);
  const samples: number[] = new Array(n).fill(0);
  const beepDuration = Math.floor(0.08 * SAMPLE_RATE);
  const beep2Start = Math.floor(0.14 * SAMPLE_RATE);

  for (let i = 0; i < n; i++) {
    let beepI = -1;
    if (i < beepDuration) {
      beepI = i;
    } else if (i >= beep2Start) {
      beepI = i - beep2Start;
    }
    if (beepI >= 0) {
      const t = beepI / SAMPLE_RATE;
      const env = Math.exp(-20 * t);
      samples[i] = Math.sin(2 * Math.PI * 880 * (i / SAMPLE_RATE)) * env * 0.6;
    }
  }
  return samples;
}

function genGust(): number[] {
  return generateNoise(0.6, 2, 0.5);
}

function genQuake(): number[] {
  const rumble = generateNoise(0.5, 3, 0.55);
  const sub = generateTone(40, 0.5, 6, 0.45);
  return mixSamples(rumble, sub);
}

function genChallengeStart(): number[] {
  // C5 (523.25 Hz) → E5 (659.25 Hz), each ~0.12s
  const n = Math.floor(0.25 * SAMPLE_RATE);
  const half = Math.floor(n / 2);
  const samples: number[] = new Array(n);
  const freqs = [523.25, 659.25];
  for (let i = 0; i < n; i++) {
    const seg = i < half ? 0 : 1;
    const localI = i < half ? i : i - half;
    const t = localI / SAMPLE_RATE;
    const env = Math.exp(-12 * t);
    samples[i] = Math.sin(2 * Math.PI * freqs[seg] * (i / SAMPLE_RATE)) * env * 0.55;
  }
  return samples;
}

function genChallengeSuccess(): number[] {
  // C5 → E5 → G5 fanfare, each ~0.133s
  const n = Math.floor(0.4 * SAMPLE_RATE);
  const seg = Math.floor(n / 3);
  const samples: number[] = new Array(n);
  const freqs = [523.25, 659.25, 783.99];
  for (let i = 0; i < n; i++) {
    const s = Math.min(2, Math.floor(i / seg));
    const localI = i - s * seg;
    const t = localI / SAMPLE_RATE;
    const env = Math.exp(-8 * t);
    samples[i] = Math.sin(2 * Math.PI * freqs[s] * (i / SAMPLE_RATE)) * env * 0.55;
  }
  return samples;
}

function genChallengeFail(): number[] {
  // 440 Hz → 330 Hz descend over 0.4s (linear pitch glide)
  const n = Math.floor(0.4 * SAMPLE_RATE);
  const samples: number[] = new Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 440 - 110 * progress; // 440→330
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-4 * t);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    samples[i] = Math.sin(phase) * env * 0.55;
  }
  return samples;
}

function genCoinCollect(): number[] {
  return generateTone(1200, 0.1, 20, 0.65);
}

function genComboUp(): number[] {
  // C5 → E5 → G5 → C6 arpeggio, each ~0.08s
  const n = Math.floor(0.32 * SAMPLE_RATE);
  const seg = Math.floor(n / 4);
  const samples: number[] = new Array(n);
  const freqs = [523.25, 659.25, 783.99, 1046.5];
  for (let i = 0; i < n; i++) {
    const s = Math.min(3, Math.floor(i / seg));
    const localI = i - s * seg;
    const t = localI / SAMPLE_RATE;
    const env = Math.exp(-15 * t);
    samples[i] = Math.sin(2 * Math.PI * freqs[s] * (i / SAMPLE_RATE)) * env * 0.5;
  }
  return samples;
}

function genNearMiss(): number[] {
  // 392 Hz (G4) → 523 Hz (C5) relief bend over 0.25s
  const n = Math.floor(0.25 * SAMPLE_RATE);
  const samples: number[] = new Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 392 + 131 * progress; // 392→523
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-5 * t);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    samples[i] = Math.sin(phase) * env * 0.55;
  }
  return samples;
}

function genGameOver(): number[] {
  const noise = generateNoise(0.4, 8, 0.5);
  const low = generateTone(80, 0.4, 10, 0.4);
  const crack = generateTone(200, 0.4, 15, 0.3);
  return mixSamples(noise, low, crack);
}

function genSpeedChange(): number[] {
  // 300 Hz → 1300 Hz pitch bend over 0.3s
  const n = Math.floor(0.3 * SAMPLE_RATE);
  const samples: number[] = new Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 300 + 1000 * progress; // 300→1300
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-6 * t);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    samples[i] = Math.sin(phase) * env * 0.55;
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Build & export
// ---------------------------------------------------------------------------

export type SfxName =
  | 'obstacleSwipe'
  | 'obstacleHit'
  | 'warningBeep'
  | 'gust'
  | 'quake'
  | 'challengeStart'
  | 'challengeSuccess'
  | 'challengeFail'
  | 'coinCollect'
  | 'comboUp'
  | 'nearMiss'
  | 'gameOver'
  | 'speedChange';

type SfxUriMap = Readonly<Record<SfxName, string>>;

function buildSfxUris(): SfxUriMap {
  return {
    obstacleSwipe:    samplesToBase64(genObstacleSwipe()),
    obstacleHit:      samplesToBase64(genObstacleHit()),
    warningBeep:      samplesToBase64(genWarningBeep()),
    gust:             samplesToBase64(genGust()),
    quake:            samplesToBase64(genQuake()),
    challengeStart:   samplesToBase64(genChallengeStart()),
    challengeSuccess: samplesToBase64(genChallengeSuccess()),
    challengeFail:    samplesToBase64(genChallengeFail()),
    coinCollect:      samplesToBase64(genCoinCollect()),
    comboUp:          samplesToBase64(genComboUp()),
    nearMiss:         samplesToBase64(genNearMiss()),
    gameOver:         samplesToBase64(genGameOver()),
    speedChange:      samplesToBase64(genSpeedChange()),
  };
}

// Generated once at module load; each entry is a self-contained data URI
export const SFX_URIS: SfxUriMap = buildSfxUris();
