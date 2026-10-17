import { describe, expect, it } from 'vitest';
import realGames from '../../games.json';
import { GamesDataError, LIMITS, parseGames, playUrl, type GameEntry } from '../../src/logic/games';

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

  it('accepts the real games.json', () => {
    expect(parseGames(realGames).length).toBeGreaterThan(0);
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
      'game 1: status must be one of live, coming-soon',
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

describe('playUrl', () => {
  it('links to the game folder next to the portal', () => {
    expect(playUrl(valid)).toBe('./star-destroyer/');
  });
});
