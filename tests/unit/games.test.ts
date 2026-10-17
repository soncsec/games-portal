import { describe, expect, it } from 'vitest';
import {
  GamesDataError,
  LIMITS,
  parseGameFiles,
  parseGames,
  playUrl,
  shownGames,
  type GameEntry,
} from '../../src/logic/games';
import { readGameFiles } from '../support/gameFiles';

const valid: GameEntry = {
  slug: 'star-destroyer',
  title: 'Star Destroyer',
  summary: 'A vertical space shooter with eight levels and bosses.',
  image: 'images/star-destroyer.png',
  tags: ['shooter', 'arcade'],
  status: 'live',
};

/** Returns the problem list parseGames reports for `data`. */
function problems(data: unknown): string[] {
  try {
    parseGames(data);
  } catch (e) {
    if (e instanceof GamesDataError) return e.problems;
    throw e;
  }
  return [];
}

const one = (patch: Record<string, unknown>): unknown[] => [{ ...valid, ...patch }];

describe('parseGames', () => {
  it('accepts valid entries and returns them unchanged', () => {
    const second = { ...valid, slug: 'rocket-race', title: 'Rocket Race', status: 'coming-soon' };
    expect(parseGames([valid, second])).toEqual([valid, second]);
  });

  it('accepts an empty list', () => {
    expect(parseGames([])).toEqual([]);
  });

  it('accepts the real games/ files', () => {
    expect(parseGameFiles(readGameFiles()).length).toBeGreaterThan(0);
  });

  it('rejects data that is not a list', () => {
    expect(problems({ games: [] })).toEqual(['top level must be a list of games']);
    expect(problems(null)).toHaveLength(1);
  });

  it('rejects entries that are not objects', () => {
    expect(problems([valid, 'star-destroyer', null, []])).toEqual([
      'game 2: must be an object',
      'game 3: must be an object',
      'game 4: must be an object',
    ]);
  });

  it.each([
    ['Star-Destroyer'],
    ['star_destroyer'],
    ['star--destroyer'],
    ['-star'],
    ['../etc'],
    ['star destroyer'],
  ])('rejects slug %j', (slug) => {
    expect(problems(one({ slug }))).toEqual(['game 1: slug must be lowercase words joined by "-"']);
  });

  it('rejects a slug that is too long or missing', () => {
    expect(problems(one({ slug: 'a'.repeat(LIMITS.slugMax + 1) }))).toHaveLength(1);
    expect(problems(one({ slug: undefined }))).toHaveLength(1);
  });

  it('rejects duplicate slugs', () => {
    expect(problems([valid, { ...valid }])).toEqual(['game 2: duplicate slug "star-destroyer"']);
  });

  it('enforces title and summary lengths and trimmed text', () => {
    expect(problems(one({ title: '' }))).toHaveLength(1);
    expect(problems(one({ title: 'x'.repeat(LIMITS.titleMax + 1) }))).toHaveLength(1);
    expect(problems(one({ title: ' Star Destroyer' }))).toHaveLength(1);
    expect(problems(one({ summary: 'Too short.' }))).toHaveLength(1);
    expect(problems(one({ summary: 'x'.repeat(LIMITS.summaryMax + 1) }))).toHaveLength(1);
    expect(problems(one({ title: 'x'.repeat(LIMITS.titleMax) }))).toEqual([]);
  });

  it.each([
    ['star-destroyer.png'],
    ['images/../secret.png'],
    ['https://example.com/a.png'],
    ['images/a.svg'],
    ['images/A.png'],
    ['/images/a.png'],
    [42],
  ])('rejects image %j', (image) => {
    expect(problems(one({ image }))).toHaveLength(1);
  });

  it('accepts webp and jpg images', () => {
    expect(problems(one({ image: 'images/a-b.webp' }))).toEqual([]);
    expect(problems(one({ image: 'images/a.jpg' }))).toEqual([]);
  });

  it.each([
    [['a', 'b', 'c', 'd', 'e']],
    [['Shooter']],
    [['x'.repeat(17)]],
    [[1]],
    ['shooter'],
    [[' shooter']],
  ])('rejects tags %j', (tags) => {
    expect(problems(one({ tags }))).toHaveLength(1);
  });

  it('accepts multi-word tags and no tags', () => {
    expect(problems(one({ tags: ['top down', 'retro'] }))).toEqual([]);
    expect(problems(one({ tags: [] }))).toEqual([]);
  });

  it('rejects an unknown status', () => {
    expect(problems(one({ status: 'beta' }))).toEqual([
      'game 1: status must be one of live, coming-soon, in-development',
    ]);
  });

  it('rejects unknown fields (catches typos and smuggled HTML)', () => {
    expect(problems(one({ html: '<b>hi</b>' }))).toEqual(['game 1: unknown field(s) html']);
  });

  it('reports every problem at once', () => {
    expect(problems([{ ...valid, slug: 'Bad', status: 'x' }, 7])).toHaveLength(3);
  });

  it('the error message lists the problems', () => {
    expect(() => parseGames(one({ status: 'x' }))).toThrow(/status must be one of/);
  });
});

describe('reserved and in-development', () => {
  it.each([['assets'], ['images']])('rejects the reserved slug %j', (slug) => {
    expect(problems(one({ slug }))).toEqual([`game 1: slug "${slug}" is reserved for the portal`]);
  });

  it('lets an in-development game claim its slug without an image', () => {
    const claim = { ...valid, status: 'in-development' } as Record<string, unknown>;
    delete claim['image'];
    expect(problems([claim])).toEqual([]);
  });

  it('still requires an image for live and coming-soon games', () => {
    for (const status of ['live', 'coming-soon']) {
      const g = { ...valid, status } as Record<string, unknown>;
      delete g['image'];
      expect(problems([g])).toHaveLength(1);
    }
  });

  it('checks an in-development image if one is given', () => {
    expect(problems(one({ status: 'in-development', image: 'nope.png' }))).toHaveLength(1);
  });
});

describe('parseGameFiles', () => {
  const file = (g: Partial<GameEntry> & { slug: string }) => ({ [`../games/${g.slug}.json`]: g });

  it('reads one file per game', () => {
    const games = parseGameFiles({
      ...file(valid),
      ...file({ ...valid, slug: 'rocket-race', title: 'Rocket Race' }),
    });
    expect(games.map((g) => g.slug)).toEqual(['rocket-race', 'star-destroyer']);
  });

  it('requires the file name to match the slug', () => {
    expect(() => parseGameFiles({ '../games/other-game.json': valid })).toThrow(
      /other-game\.json: file name must be the game's slug \("star-destroyer\.json"\)/,
    );
  });

  it('names problems by file, not by position', () => {
    try {
      parseGameFiles(file({ ...valid, status: 'beta' as never }));
      expect.unreachable();
    } catch (e) {
      expect((e as GamesDataError).problems).toEqual([
        '../games/star-destroyer.json: status must be one of live, coming-soon, in-development',
      ]);
    }
  });

  it('accepts no games at all', () => {
    expect(parseGameFiles({})).toEqual([]);
  });
});

describe('shownGames', () => {
  const g = (slug: string, title: string, status: GameEntry['status']): GameEntry => ({
    ...valid,
    slug,
    title,
    status,
  });

  it('hides in-development games and lists live first, then coming soon, each by title', () => {
    const shown = shownGames([
      g('zeta', 'Zeta', 'coming-soon'),
      g('secret', 'Secret', 'in-development'),
      g('beta', 'Beta', 'live'),
      g('alpha', 'Alpha', 'coming-soon'),
      g('omega', 'Omega', 'live'),
    ]);
    expect(shown.map((x) => x.slug)).toEqual(['beta', 'omega', 'alpha', 'zeta']);
  });
});

describe('playUrl', () => {
  it('links to the game folder next to the portal', () => {
    expect(playUrl(valid)).toBe('./star-destroyer/');
  });
});
