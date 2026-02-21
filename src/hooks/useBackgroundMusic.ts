import { useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

// --- Procedural WAV generation (pentatonic melody + bass, ~8 bar loop) ---

const SAMPLE_RATE = 22050;
const BPM = 120;
const BEATS_PER_BAR = 4;
const BARS = 8;
const BEAT_DURATION = 60 / BPM; // 0.5s
const TOTAL_BEATS = BARS * BEATS_PER_BAR; // 32
const TOTAL_SAMPLES = Math.floor(TOTAL_BEATS * BEAT_DURATION * SAMPLE_RATE);

// C pentatonic: C4, E4, G4, A4, C5
const MELODY_FREQS = [261.63, 329.63, 392.0, 440.0, 523.25];
// Bass: C3, G2, A2, E3
const BASS_FREQS = [130.81, 98.0, 110.0, 164.81];

// Simple deterministic melody pattern (indices into MELODY_FREQS)
const MELODY_PATTERN = [0, 2, 4, 3, 2, 4, 3, 1, 0, 1, 2, 3, 4, 3, 2, 0,
                        2, 3, 4, 2, 1, 0, 1, 3, 4, 2, 0, 1, 3, 4, 2, 0];
// Bass pattern (indices into BASS_FREQS, one per bar, repeated per beat)
const BASS_PATTERN = [0, 0, 1, 1, 2, 2, 3, 3];

function generateWavBase64(): string {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = TOTAL_SAMPLES * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate samples
  const samplesPerBeat = Math.floor(BEAT_DURATION * SAMPLE_RATE);

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const beat = Math.floor(i / samplesPerBeat);
    const bar = Math.floor(beat / BEATS_PER_BAR);
    const t = i / SAMPLE_RATE;
    const beatT = (i % samplesPerBeat) / SAMPLE_RATE; // time within beat

    // Melody: sine with soft envelope
    const melodyIdx = MELODY_PATTERN[beat % MELODY_PATTERN.length];
    const melodyFreq = MELODY_FREQS[melodyIdx];
    const melodyEnv = Math.exp(-beatT * 4); // quick decay
    const melody = Math.sin(2 * Math.PI * melodyFreq * t) * melodyEnv * 0.3;

    // Add a slight overtone for warmth
    const overtone = Math.sin(2 * Math.PI * melodyFreq * 2 * t) * melodyEnv * 0.08;

    // Bass: low sine, slower decay
    const bassIdx = BASS_PATTERN[bar % BASS_PATTERN.length];
    const bassFreq = BASS_FREQS[bassIdx];
    const bassEnv = Math.exp(-beatT * 2);
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * bassEnv * 0.25;

    // Mix and soft-clip
    let sample = melody + overtone + bass;
    sample = Math.max(-0.9, Math.min(0.9, sample));

    // Convert to 16-bit PCM
    const pcm = Math.floor(sample * 32767);
    view.setInt16(headerSize + i * 2, pcm, true);
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Generate once at module level
let cachedUri: string | null = null;
function getWavUri(): string {
  if (!cachedUri) {
    cachedUri = `data:audio/wav;base64,${generateWavBase64()}`;
  }
  return cachedUri;
}

export function useBackgroundMusic() {
  const soundRef = useRef<Audio.Sound | null>(null);

  const startMusic = useCallback(async () => {
    try {
      // Stop any existing playback
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: getWavUri() },
        { shouldPlay: true, isLooping: true, volume: 0.3 },
      );
      soundRef.current = sound;
    } catch {
      // Music is non-critical; fail silently
    }
  }, []);

  const stopMusic = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {
      // fail silently
    }
  }, []);

  return { startMusic, stopMusic };
}
