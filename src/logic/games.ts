/** One game card on the portal (ADR-008). */
export interface GameEntry {
  /** URL folder name: games.soncrant.com/<slug>/ */
  slug: string;
  title: string;
  /** One or two sentences shown on the card. */
  summary: string;
  /** Card image path inside the portal, e.g. images/star-destroyer.png. Optional only while in-development. */
  image?: string;
  tags: string[];
  status: GameStatus;
  /** Local Vite dev server port, unique per game (ADR-011). 5170 is the portal's. */
  devPort?: number;
}

/**
 * live: card links to the game. coming-soon: card shown, not clickable.
 * in-development: claims the slug and URL (ADR-011); no card yet.
 */
export type GameStatus = 'live' | 'coming-soon' | 'in-development';

/** A game that gets a card: its image is guaranteed. */
export type ShownGame = GameEntry & { image: string; status: 'live' | 'coming-soon' };

export const LIMITS = {
  slugMax: 40,
  titleMax: 40,
  summaryMin: 20,
  summaryMax: 200,
  tagsMax: 4,
  devPortMin: 5171,
  devPortMax: 5899,
} as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE = /^images\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|webp|jpg)$/;
const TAG = /^[a-z0-9]+(?: [a-z0-9]+)*$/;
const KEYS = ['slug', 'title', 'summary', 'image', 'tags', 'status', 'devPort'] as const;
const STATUSES: readonly string[] = [
  'live',
  'coming-soon',
  'in-development',
] satisfies GameStatus[];
/** The portal's own top-level folders on the server; a game can't use these names. */
const RESERVED_SLUGS: readonly string[] = ['assets', 'images'];

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
  const ports = new Map<number, string>();
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

    const { slug, title, summary, image, tags, status, devPort } = raw;
    const text = (v: unknown, name: string, min: number, max: number): v is string => {
      if (typeof v !== 'string' || v.trim() !== v || v.length < min || v.length > max) {
        problems.push(`${where}: ${name} must be ${min}–${max} characters with no outer spaces`);
        return false;
      }
      return true;
    };

    if (text(slug, 'slug', 1, LIMITS.slugMax)) {
      if (!SLUG.test(slug)) problems.push(`${where}: slug must be lowercase words joined by "-"`);
      else if (RESERVED_SLUGS.includes(slug))
        problems.push(`${where}: slug "${slug}" is reserved for the portal`);
      else if (seen.has(slug)) problems.push(`${where}: duplicate slug "${slug}"`);
      seen.add(slug);
    }
    text(title, 'title', 1, LIMITS.titleMax);
    text(summary, 'summary', LIMITS.summaryMin, LIMITS.summaryMax);
    const imageOptional = status === 'in-development' && image === undefined;
    if (!imageOptional && (typeof image !== 'string' || !IMAGE.test(image))) {
      problems.push(`${where}: image must look like images/<name>.png (or .webp, .jpg)`);
    }
    if (
      !Array.isArray(tags) ||
      tags.length > LIMITS.tagsMax ||
      !tags.every((t) => typeof t === 'string' && TAG.test(t) && t.length <= 16)
    ) {
      problems.push(`${where}: tags must be up to ${LIMITS.tagsMax} short lowercase words`);
    }
    if (devPort !== undefined) {
      if (
        typeof devPort !== 'number' ||
        !Number.isInteger(devPort) ||
        devPort < LIMITS.devPortMin ||
        devPort > LIMITS.devPortMax
      ) {
        problems.push(
          `${where}: devPort must be a whole number from ${LIMITS.devPortMin} to ${LIMITS.devPortMax}`,
        );
      } else if (ports.has(devPort)) {
        problems.push(`${where}: devPort ${devPort} is already used by "${ports.get(devPort)}"`);
      } else {
        ports.set(devPort, typeof slug === 'string' ? slug : where);
      }
    }
    if (typeof status !== 'string' || !STATUSES.includes(status)) {
      problems.push(`${where}: status must be one of ${STATUSES.join(', ')}`);
    }

    if (problems.length === before) games.push(raw as unknown as GameEntry);
  });

  if (problems.length) throw new GamesDataError(problems);
  return games;
}

/**
 * Validates one file per game (games/<slug>.json), keyed by file path as Vite's
 * import.meta.glob gives them. Each file's name must match the slug inside it.
 */
export function parseGameFiles(files: Record<string, unknown>): GameEntry[] {
  const paths = Object.keys(files).sort();
  const problems: string[] = [];
  for (const path of paths) {
    const name = /([^/]+)\.json$/.exec(path)?.[1];
    const raw = files[path];
    const slug = isRecord(raw) ? raw['slug'] : undefined;
    if (name !== slug)
      problems.push(`${path}: file name must be the game's slug ("${String(slug)}.json")`);
  }
  try {
    const games = parseGames(paths.map((p) => files[p]));
    if (problems.length) throw new GamesDataError(problems);
    return games;
  } catch (e) {
    if (e instanceof GamesDataError) {
      // Name problems by file rather than by position.
      const named = e.problems.map((m) =>
        m.replace(/^game (\d+):/, (_, n) => `${paths[Number(n) - 1]}:`),
      );
      throw new GamesDataError([...problems.filter((m) => !named.includes(m)), ...named]);
    }
    throw e;
  }
}

const STATUS_ORDER = { live: 0, 'coming-soon': 1 } as const;

/** The games that get a card: live first, then coming soon, each by title. */
export function shownGames(games: GameEntry[]): ShownGame[] {
  return games
    .filter((g): g is ShownGame => g.status !== 'in-development' && g.image !== undefined)
    .sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title),
    );
}

/** Relative link to a game's folder, next to the portal page. */
export function playUrl(game: Pick<GameEntry, 'slug'>): string {
  return `./${game.slug}/`;
}
