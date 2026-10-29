// Generates the placeholder beeps in media/sounds. No dependencies: `node scripts/gen-placeholder-wav.mjs`.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22050;
const outDir = join(import.meta.dirname, '..', 'media', 'sounds');

/** notes: [frequencyHz, durationSec][] played one after another with a soft envelope. */
function tones(notes, gain = 0.35) {
  const samples = [];
  for (const [freq, dur] of notes) {
    const n = Math.round(dur * RATE);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const attack = Math.min(1, i / (0.01 * RATE));
      const release = Math.min(1, (n - i) / (0.04 * RATE));
      // A touch of the octave makes it sound less like a test tone.
      const wave = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
      samples.push(freq === 0 ? 0 : wave * attack * release * gain);
    }
  }
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const sounds = {
  'error-1': [[988, 0.12], [0, 0.03], [740, 0.22]],
  'error-2': [[880, 0.08], [0, 0.03], [880, 0.08], [0, 0.03], [659, 0.2]],
  'warning-1': [[740, 0.18]],
  'test-1': [[659, 0.09], [784, 0.09], [988, 0.09], [1319, 0.2]],
};
for (const [name, notes] of Object.entries(sounds)) {
  writeFileSync(join(outDir, `${name}.wav`), wav(tones(notes)));
}
console.log(`wrote ${Object.keys(sounds).length} files to ${outDir}`);
