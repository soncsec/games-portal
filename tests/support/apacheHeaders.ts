import { readFileSync } from 'node:fs';

/** The production Apache config for games.soncrant.com. */
export const VHOST_PATH = 'deploy/apache/games-vhost.conf';

export function readVhost(): string {
  return readFileSync(`${process.cwd()}/${VHOST_PATH}`, 'utf8');
}

/** The `Header always set Name "value"` lines: the headers sent on every response. */
export function securityHeaders(conf = readVhost()): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const m of conf.matchAll(/^\s*Header always set ([A-Za-z-]+) "([^"]*)"\s*$/gm)) {
    const [, name, value] = m;
    if (name && value !== undefined) headers[name] = value;
  }
  return headers;
}

/** The regex from the long-cache <LocationMatch> block. */
export function immutableCachePattern(conf = readVhost()): RegExp {
  const m = /<LocationMatch "([^"]+)">\s*\n\s*Header set Cache-Control "[^"]*immutable"/.exec(conf);
  if (!m?.[1]) throw new Error('long-cache LocationMatch not found');
  return new RegExp(m[1]);
}
