import type { ErrorBurst, ErrorSource } from './types';

export type Emotion = 'worried' | 'surprised' | 'happy' | 'angry';

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

/** Natsuki's lines, used when no character is given. */
export const DEFAULT_PHRASES: readonly string[] = [
  'Хозяин, ошибка!',
  'Хозяин, там опять красненькое!',
  'Ой-ой, что-то сломалось…',
  'Хозяин, компилятор ругается!',
  'Хозяин, что-то не так~',
  'Не волнуйтесь, хозяин, вы справитесь!',
];

export const TEST_PHRASE = 'Хозяин, это всего лишь проверка~';

/** Voice line names: `voice-<index in the character's phrases>` and `voice-test`. */
export const TEST_VOICE = 'voice-test';

/** What the picker needs from a character pack. */
export interface CharacterLines {
  phrases: readonly string[];
  testPhrase: string;
  errorEmotions: readonly Emotion[];
}

const DEFAULT_LINES: CharacterLines = {
  phrases: DEFAULT_PHRASES,
  testPhrase: TEST_PHRASE,
  errorEmotions: ['worried', 'surprised'],
};

export interface ReactionPickerOptions {
  character?: CharacterLines;
  /** User phrases from the settings; they replace the character's and have no voice lines. */
  phrases?: readonly string[];
  /** Returns a number in [0, 1). Injectable for tests. */
  rng?: () => number;
}

export class ReactionPicker {
  private readonly lines: CharacterLines;
  private readonly phrases: readonly string[];
  private readonly voiced: boolean;
  private readonly rng: () => number;
  private lastPhrase?: string;

  constructor(options: ReactionPickerOptions = {}) {
    this.lines = options.character ?? DEFAULT_LINES;
    const custom = options.phrases?.map((p) => p.trim()).filter((p) => p.length > 0);
    this.voiced = !custom || custom.length === 0;
    this.phrases = this.voiced ? this.lines.phrases : custom!;
    this.rng = options.rng ?? Math.random;
  }

  pick(burst: ErrorBurst): Reaction {
    const base = { source: burst.source, detail: burst.message, count: burst.count };
    if (burst.source === 'test') {
      return { ...base, phrase: this.lines.testPhrase, emotion: 'happy', sound: 'test', voice: TEST_VOICE };
    }
    const phrase = this.pickPhrase();
    const voice = this.voiceFor(phrase);
    if (burst.severity === 'warning') {
      return { ...base, phrase, emotion: 'surprised', sound: 'warning', voice };
    }
    const emotions = this.lines.errorEmotions;
    const emotion = emotions[Math.min(Math.floor(this.rng() * emotions.length), emotions.length - 1)];
    return { ...base, phrase, emotion, sound: 'error', voice };
  }

  private voiceFor(phrase: string): string | undefined {
    const i = this.voiced ? this.phrases.indexOf(phrase) : -1;
    return i >= 0 ? `voice-${i}` : undefined;
  }

  private pickPhrase(): string {
    const candidates =
      this.phrases.length > 1 ? this.phrases.filter((p) => p !== this.lastPhrase) : this.phrases;
    const phrase = candidates[Math.min(Math.floor(this.rng() * candidates.length), candidates.length - 1)];
    this.lastPhrase = phrase;
    return phrase;
  }
}
