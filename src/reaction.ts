import type { ErrorBurst, ErrorSource } from './types';

export type Emotion = 'worried' | 'surprised' | 'happy';

export interface Reaction {
  phrase: string;
  emotion: Emotion;
  /** Sound name; the player looks for `<sound>*.wav`. */
  sound: string;
  /** Voice line for the phrase (`<voice>.wav`), played instead of `sound` when the file exists. */
  voice?: string;
  source: ErrorSource;
  detail: string;
  count: number;
}

export const DEFAULT_PHRASES: readonly string[] = [
  'Хозяин, ошибка!',
  'Хозяин, там опять красненькое!',
  'Ой-ой, что-то сломалось…',
  'Хозяин, компилятор ругается!',
  'Хозяин, что-то не так~',
  'Не волнуйтесь, хозяин, вы справитесь!',
];

export const TEST_PHRASE = 'Хозяин, это всего лишь проверка~';

/** Voice line names: `voice-<index in DEFAULT_PHRASES>` and `voice-test`. */
export const TEST_VOICE = 'voice-test';
export const voiceFor = (phrase: string): string | undefined => {
  const i = DEFAULT_PHRASES.indexOf(phrase);
  return i >= 0 ? `voice-${i}` : undefined;
};

export interface ReactionPickerOptions {
  phrases?: readonly string[];
  /** Returns a number in [0, 1). Injectable for tests. */
  rng?: () => number;
}

export class ReactionPicker {
  private readonly phrases: readonly string[];
  private readonly rng: () => number;
  private lastPhrase?: string;

  constructor(options: ReactionPickerOptions = {}) {
    const custom = options.phrases?.map((p) => p.trim()).filter((p) => p.length > 0);
    this.phrases = custom && custom.length > 0 ? custom : DEFAULT_PHRASES;
    this.rng = options.rng ?? Math.random;
  }

  pick(burst: ErrorBurst): Reaction {
    const base = { source: burst.source, detail: burst.message, count: burst.count };
    if (burst.source === 'test') {
      return { ...base, phrase: TEST_PHRASE, emotion: 'happy', sound: 'test', voice: TEST_VOICE };
    }
    const phrase = this.pickPhrase();
    const voice = voiceFor(phrase);
    if (burst.severity === 'warning') {
      return { ...base, phrase, emotion: 'surprised', sound: 'warning', voice };
    }
    const emotion: Emotion = this.rng() < 0.5 ? 'worried' : 'surprised';
    return { ...base, phrase, emotion, sound: 'error', voice };
  }

  private pickPhrase(): string {
    const candidates =
      this.phrases.length > 1 ? this.phrases.filter((p) => p !== this.lastPhrase) : this.phrases;
    const phrase = candidates[Math.min(Math.floor(this.rng() * candidates.length), candidates.length - 1)];
    this.lastPhrase = phrase;
    return phrase;
  }
}
