import { readdirSync, readFileSync } from 'node:fs';
import { parseGameFiles, shownGames, type GameEntry, type ShownGame } from '../../src/logic/games';

/** The real games/<slug>.json files, keyed like Vite's import.meta.glob ('../games/<slug>.json'). */
export function readGameFiles(): Record<string, unknown> {
  const dir = `${process.cwd()}/games`;
  const files: Record<string, unknown> = {};
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    files[`../games/${name}`] = JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
  }
  return files;
}

export const allGames = (): GameEntry[] => parseGameFiles(readGameFiles());
/** The cards the page shows, in page order. */
export const cardGames = (): ShownGame[] => shownGames(allGames());
