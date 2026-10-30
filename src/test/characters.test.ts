import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import { describe, it } from 'node:test';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_CHARACTER, loadCharacter, loadCharacters, resolveCharacter } from '../characters';
import { DEFAULT_PHRASES, TEST_PHRASE } from '../reaction';

const bundled = path.resolve(__dirname, '../../media/characters');

function tempPack(json: unknown, sprites = ['idle.png']): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaii-pack-'));
  fs.writeFileSync(path.join(dir, 'character.json'), typeof json === 'string' ? json : JSON.stringify(json));
  for (const s of sprites) {
    fs.writeFileSync(path.join(dir, s), '');
  }
  return dir;
}

const valid = { name: 'Тест', phrases: ['Раз', ' ', 'Два'], testPhrase: 'Проверка' };

describe('characters', () => {
  it('loads the bundled packs with Natsuki first', () => {
    const list = loadCharacters(bundled);
    assert.deepEqual(list.map((c) => c.id), ['natsuki', 'kurilov']);
    assert.equal(list[0].id, DEFAULT_CHARACTER);
  });

  it("keeps Natsuki's lines in sync with the built-in defaults", () => {
    const natsuki = loadCharacters(bundled)[0];
    assert.deepEqual(natsuki.phrases, DEFAULT_PHRASES);
    assert.equal(natsuki.testPhrase, TEST_PHRASE);
    assert.deepEqual(natsuki.errorEmotions, ['worried', 'surprised']);
  });

  it('reads error emotions and trims blank phrases', () => {
    const c = loadCharacter(tempPack({ ...valid, errorEmotions: ['angry', 'happy', 'worried'] }), 'x');
    assert.deepEqual(c?.phrases, ['Раз', 'Два']);
    assert.deepEqual(c?.errorEmotions, ['angry', 'worried']);
  });

  it('skips broken packs', () => {
    assert.equal(loadCharacter(tempPack('{ not json'), 'a'), undefined);
    assert.equal(loadCharacter(tempPack({ ...valid, name: '' }), 'b'), undefined);
    assert.equal(loadCharacter(tempPack({ ...valid, phrases: [] }), 'c'), undefined);
    assert.equal(loadCharacter(tempPack(valid, ['happy.png']), 'd'), undefined, 'no idle sprite');
    assert.deepEqual(loadCharacters(path.join(os.tmpdir(), 'kawaii-no-such-dir')), []);
  });

  it('falls back to the default character for an unknown id', () => {
    const list = loadCharacters(bundled);
    assert.equal(resolveCharacter(list, 'kurilov')?.id, 'kurilov');
    assert.equal(resolveCharacter(list, 'nobody')?.id, 'natsuki');
    assert.equal(resolveCharacter([], 'natsuki'), undefined);
  });
});
