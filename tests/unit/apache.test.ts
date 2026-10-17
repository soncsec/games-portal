import { describe, expect, it } from 'vitest';
import { immutableCachePattern, readVhost, securityHeaders } from '../support/apacheHeaders';

const conf = readVhost();

describe('games.soncrant.com Apache config', () => {
  it('serves only the games folder, for the games host names', () => {
    expect(conf).toMatch(/^\s*ServerName games\.rdmustang\.com$/m);
    expect(conf).toMatch(/^\s*ServerAlias games\.soncrant\.com$/m);
    expect(conf).toMatch(/^\s*DocumentRoot \/var\/www\/html\/soncrant\.com\/pub\/games$/m);
  });

  it('turns off folder listings and .htaccess, and follows only same-owner symlinks', () => {
    const options = [...conf.matchAll(/^\s*Options (.+)$/gm)].map((m) => m[1]);
    expect(options).toEqual(['SymLinksIfOwnerMatch', 'SymLinksIfOwnerMatch']);
    const overrides = [...conf.matchAll(/^\s*AllowOverride (.+)$/gm)].map((m) => m[1]);
    expect(overrides).toEqual(['None', 'None']);
  });

  it('sends the security headers from ADR-007', () => {
    const h = securityHeaders(conf);
    expect(Object.keys(h).sort()).toEqual(
      [
        'Content-Security-Policy',
        'Cross-Origin-Resource-Policy',
        'Permissions-Policy',
        'Referrer-Policy',
        'X-Content-Type-Options',
        'X-Frame-Options',
      ].sort(),
    );
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    // Ignored by browsers over HTTP (ADR-010), and Chrome logs an error about it.
    expect(h).not.toHaveProperty('Cross-Origin-Opener-Policy');
  });

  it('CSP allows only this origin and blocks the risky features', () => {
    const csp = securityHeaders(conf)['Content-Security-Policy'] ?? '';
    const directives = Object.fromEntries(
      csp.split(';').map((d) => {
        const [name = '', ...values] = d.trim().split(/\s+/);
        return [name, values];
      }),
    );
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['script-src']).toEqual(["'self'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
  });

  it('caches only content-hashed build files for a year', () => {
    const re = immutableCachePattern(conf);
    // Real Vite output names from the portal and the game.
    for (const hashed of [
      '/assets/index-Bge2lfGH.js',
      '/assets/index-DqAiFwRg.css',
      '/assets/PressStart2P-Regular-2BZhbCiP.ttf',
      '/star-destroyer/assets/index-C_1a-9Zz.js',
    ]) {
      expect(re.test(hashed), hashed).toBe(true);
    }
    // Unhashed files must be rechecked, or players would keep old art after a release.
    for (const plain of [
      '/star-destroyer/assets/sprites/enemy-explosion.png',
      '/star-destroyer/assets/ship-01-red.png',
      '/star-destroyer/assets/bg-stage-back.png',
      '/images/star-destroyer.png',
      '/index.html',
      '/star-destroyer/assets/manifest.js',
    ]) {
      expect(re.test(plain), plain).toBe(false);
    }
  });
});
