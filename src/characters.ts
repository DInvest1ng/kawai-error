import * as fs from 'fs';
import * as path from 'path';
import type { Emotion } from './reaction';

export const DEFAULT_CHARACTER = 'natsuki';
export const SPRITE_NAMES = ['idle', 'talk', 'worried', 'surprised', 'happy', 'angry'] as const;
export const SPRITE_EXTENSIONS = ['.png', '.gif', '.webp', '.svg'];

const ERROR_EMOTIONS: readonly Emotion[] = ['worried', 'surprised', 'angry'];

/** A character pack: `media/characters/<id>/` with `character.json`, sprites and optional voice lines. */
export interface Character {
  id: string;
  name: string;
  dir: string;
  phrases: string[];
  testPhrase: string;
  /** Faces picked at random for errors. */
  errorEmotions: Emotion[];
}

/** Reads every valid pack in `charactersDir`, sorted with the default character first. */
export function loadCharacters(charactersDir: string): Character[] {
  let ids: string[];
  try {
    ids = fs.readdirSync(charactersDir);
  } catch {
    return [];
  }
  const list = ids
    .map((id) => loadCharacter(path.join(charactersDir, id), id))
    .filter((c): c is Character => !!c);
  return list.sort((a, b) => Number(b.id === DEFAULT_CHARACTER) - Number(a.id === DEFAULT_CHARACTER) || a.id.localeCompare(b.id));
}

export function loadCharacter(dir: string, id: string): Character | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dir, 'character.json'), 'utf8'));
  } catch {
    return undefined;
  }
  const json = (raw ?? {}) as Record<string, unknown>;
  const name = typeof json.name === 'string' ? json.name.trim() : '';
  const phrases = strings(json.phrases);
  const testPhrase = typeof json.testPhrase === 'string' ? json.testPhrase.trim() : '';
  if (!name || phrases.length === 0 || !testPhrase || !findSprite([dir], 'idle')) {
    return undefined;
  }
  const errorEmotions = strings(json.errorEmotions).filter((e): e is Emotion =>
    (ERROR_EMOTIONS as readonly string[]).includes(e),
  );
  return {
    id,
    name,
    dir,
    phrases,
    testPhrase,
    errorEmotions: errorEmotions.length > 0 ? errorEmotions : ['worried', 'surprised'],
  };
}

/** The chosen character, or the default one (or the first available) when it doesn't exist. */
export function resolveCharacter(list: readonly Character[], id: string | undefined): Character | undefined {
  return list.find((c) => c.id === id) ?? list.find((c) => c.id === DEFAULT_CHARACTER) ?? list[0];
}

export function findSprite(dirs: string[], name: string): string | undefined {
  for (const dir of dirs) {
    for (const ext of SPRITE_EXTENSIONS) {
      const file = path.join(dir, name + ext);
      if (fs.existsSync(file)) {
        return file;
      }
    }
  }
  return undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter((v) => v.length > 0)
    : [];
}
