import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import data from '../../games.json';
import { parseGames } from '../../src/logic/games';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('card images', () => {
  for (const game of parseGames(data)) {
    it(`${game.slug}: ${game.image} exists in public/ and is a 256×192 PNG`, () => {
      const path = `${process.cwd()}/public/${game.image}`;
      expect(existsSync(path)).toBe(true);
      const bytes = readFileSync(path);
      if (game.image.endsWith('.png')) {
        expect([...bytes.subarray(0, 8)]).toEqual(PNG);
        // Cards show images at 4:3; 256×192 keeps pixels crisp at whole-number scales.
        expect(pngSize(bytes)).toEqual({ width: 256, height: 192 });
      }
    });
  }
});
