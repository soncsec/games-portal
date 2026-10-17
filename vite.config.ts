import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the portal works at games.soncrant.com/ and on staging subpaths.
  base: './',
  // Portal ports (games use 5173+; see CLAUDE.md).
  server: { port: 5170, strictPort: true },
  preview: { port: 4170, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/logic/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
