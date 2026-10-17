// Minimal Node.js types for the few APIs the tests and configs use, so we
// don't need the @types/node package. Unit tests run in Node via Vitest.
declare const process: { cwd(): string; env: Record<string, string | undefined> };
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function existsSync(path: string): boolean;
  export function readdirSync(path: string): string[];
}
