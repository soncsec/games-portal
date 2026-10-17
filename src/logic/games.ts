/** One game card on the portal (ADR-008). */
export interface GameEntry {
  /** URL folder name: games.soncrant.com/<slug>/ */
  slug: string;
  title: string;
  /** One or two sentences shown on the card. */
  summary: string;
  /** Card image path inside the portal, e.g. images/star-destroyer.png */
  image: string;
  tags: string[];
  status: GameStatus;
}

export type GameStatus = 'live' | 'coming-soon';

export const LIMITS = {
  slugMax: 40,
  titleMax: 40,
  summaryMin: 20,
  summaryMax: 200,
  tagsMax: 4,
} as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE = /^images\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|webp|jpg)$/;
const TAG = /^[a-z0-9]+(?: [a-z0-9]+)*$/;
const KEYS = ['slug', 'title', 'summary', 'image', 'tags', 'status'] as const;
const STATUSES: readonly string[] = ['live', 'coming-soon'] satisfies GameStatus[];

/** Thrown when the games data is invalid. Lists every problem found. */
export class GamesDataError extends Error {
  constructor(readonly problems: string[]) {
    super(`invalid games data:\n- ${problems.join('\n- ')}`);
    this.name = 'GamesDataError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates raw games data and returns it typed. Throws GamesDataError listing all problems. */
export function parseGames(data: unknown): GameEntry[] {
  if (!Array.isArray(data)) throw new GamesDataError(['top level must be a list of games']);
  const problems: string[] = [];
  const seen = new Set<string>();
  const games: GameEntry[] = [];

  data.forEach((raw: unknown, i) => {
    const where = `game ${i + 1}`;
    if (!isRecord(raw)) {
      problems.push(`${where}: must be an object`);
      return;
    }
    const before = problems.length;
    const extra = Object.keys(raw).filter((k) => !(KEYS as readonly string[]).includes(k));
    if (extra.length) problems.push(`${where}: unknown field(s) ${extra.join(', ')}`);

    const { slug, title, summary, image, tags, status } = raw;
    const text = (v: unknown, name: string, min: number, max: number): v is string => {
      if (typeof v !== 'string' || v.trim() !== v || v.length < min || v.length > max) {
        problems.push(`${where}: ${name} must be ${min}–${max} characters with no outer spaces`);
        return false;
      }
      return true;
    };

    if (text(slug, 'slug', 1, LIMITS.slugMax)) {
      if (!SLUG.test(slug)) problems.push(`${where}: slug must be lowercase words joined by "-"`);
      else if (seen.has(slug)) problems.push(`${where}: duplicate slug "${slug}"`);
      seen.add(slug);
    }
    text(title, 'title', 1, LIMITS.titleMax);
    text(summary, 'summary', LIMITS.summaryMin, LIMITS.summaryMax);
    if (typeof image !== 'string' || !IMAGE.test(image)) {
      problems.push(`${where}: image must look like images/<name>.png (or .webp, .jpg)`);
    }
    if (
      !Array.isArray(tags) ||
      tags.length > LIMITS.tagsMax ||
      !tags.every((t) => typeof t === 'string' && TAG.test(t) && t.length <= 16)
    ) {
      problems.push(`${where}: tags must be up to ${LIMITS.tagsMax} short lowercase words`);
    }
    if (typeof status !== 'string' || !STATUSES.includes(status)) {
      problems.push(`${where}: status must be one of ${STATUSES.join(', ')}`);
    }

    if (problems.length === before) games.push(raw as unknown as GameEntry);
  });

  if (problems.length) throw new GamesDataError(problems);
  return games;
}

/** Relative link to a game's folder, next to the portal page. */
export function playUrl(game: Pick<GameEntry, 'slug'>): string {
  return `./${game.slug}/`;
}
