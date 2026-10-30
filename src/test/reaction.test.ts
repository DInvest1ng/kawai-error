import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CharacterLines, DEFAULT_PHRASES, ReactionPicker, TEST_PHRASE, TEST_VOICE } from '../reaction';
import type { ErrorBurst } from '../types';

/** Small deterministic PRNG (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const burst = (over: Partial<ErrorBurst> = {}): ErrorBurst => ({
  source: 'diagnostics',
  severity: 'error',
  message: 'main.ts:3 oops',
  count: 1,
  ...over,
});

describe('ReactionPicker', () => {
  it('is deterministic for the same seed', () => {
    const a = new ReactionPicker({ rng: seeded(42) });
    const b = new ReactionPicker({ rng: seeded(42) });
    for (let i = 0; i < 20; i++) {
      assert.deepEqual(a.pick(burst()), b.pick(burst()));
    }
  });

  it('never repeats the same phrase twice in a row', () => {
    const picker = new ReactionPicker({ rng: seeded(7) });
    let prev = '';
    for (let i = 0; i < 200; i++) {
      const { phrase } = picker.pick(burst());
      assert.notEqual(phrase, prev);
      assert.ok(DEFAULT_PHRASES.includes(phrase));
      prev = phrase;
    }
  });

  it('eventually uses every phrase', () => {
    const picker = new ReactionPicker({ rng: seeded(1) });
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(picker.pick(burst()).phrase);
    }
    assert.equal(seen.size, DEFAULT_PHRASES.length);
  });

  it('uses custom phrases, ignoring blank ones', () => {
    const picker = new ReactionPicker({ phrases: ['  Ня!  ', '', '   '], rng: seeded(3) });
    assert.equal(picker.pick(burst()).phrase, 'Ня!');
    // A single phrase may repeat: there is nothing else to pick.
    assert.equal(picker.pick(burst()).phrase, 'Ня!');
  });

  it('falls back to default phrases when the custom list is empty', () => {
    const picker = new ReactionPicker({ phrases: [], rng: seeded(3) });
    assert.ok(DEFAULT_PHRASES.includes(picker.pick(burst()).phrase));
  });

  it('maps errors to a worried or surprised face and the error sound', () => {
    assert.equal(new ReactionPicker({ rng: () => 0.1 }).pick(burst()).emotion, 'worried');
    assert.equal(new ReactionPicker({ rng: () => 0.9 }).pick(burst()).emotion, 'surprised');
    assert.equal(new ReactionPicker({ rng: () => 0.9 }).pick(burst()).sound, 'error');
  });

  it('maps warnings to a surprised face and the warning sound', () => {
    const r = new ReactionPicker({ rng: seeded(5) }).pick(burst({ severity: 'warning' }));
    assert.equal(r.emotion, 'surprised');
    assert.equal(r.sound, 'warning');
  });

  it('gives the test command a happy reaction', () => {
    const r = new ReactionPicker({ rng: seeded(5) }).pick(burst({ source: 'test' }));
    assert.deepEqual([r.phrase, r.emotion, r.sound], [TEST_PHRASE, 'happy', 'test']);
  });

  it('pairs each built-in phrase with its own voice line', () => {
    const picker = new ReactionPicker({ rng: seeded(11) });
    for (let i = 0; i < 50; i++) {
      const r = picker.pick(burst({ severity: i % 2 ? 'warning' : 'error' }));
      assert.equal(r.voice, `voice-${DEFAULT_PHRASES.indexOf(r.phrase)}`);
    }
    assert.equal(picker.pick(burst({ source: 'test' })).voice, TEST_VOICE);
  });

  it('has no voice line for custom phrases', () => {
    const r = new ReactionPicker({ phrases: ['Своя фраза'], rng: seeded(3) }).pick(burst());
    assert.equal(r.voice, undefined);
  });

  it("uses the character's phrases, test phrase and error faces", () => {
    const character: CharacterLines = { phrases: ['А', 'Б'], testPhrase: 'Тест', errorEmotions: ['angry'] };
    const picker = new ReactionPicker({ character, rng: seeded(9) });
    for (let i = 0; i < 10; i++) {
      const r = picker.pick(burst());
      assert.ok(character.phrases.includes(r.phrase));
      assert.equal(r.emotion, 'angry');
      assert.equal(r.voice, `voice-${character.phrases.indexOf(r.phrase)}`);
    }
    assert.equal(picker.pick(burst({ source: 'test' })).phrase, 'Тест');
  });

  it("lets user phrases override the character's, without voice lines", () => {
    const character: CharacterLines = { phrases: ['А'], testPhrase: 'Тест', errorEmotions: ['worried'] };
    const r = new ReactionPicker({ character, phrases: ['Моя'], rng: seeded(1) }).pick(burst());
    assert.deepEqual([r.phrase, r.voice], ['Моя', undefined]);
  });

  it('passes source, detail and count through', () => {
    const r = new ReactionPicker({ rng: seeded(5) }).pick(burst({ source: 'task', message: 'build failed', count: 4 }));
    assert.deepEqual([r.source, r.detail, r.count], ['task', 'build failed', 4]);
  });
});
