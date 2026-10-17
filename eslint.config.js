import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Cards are built with DOM APIs and textContent, never HTML strings.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent and DOM APIs instead.' },
        { property: 'outerHTML', message: 'Use textContent and DOM APIs instead.' },
        { property: 'insertAdjacentHTML', message: 'Use DOM APIs instead.' },
      ],
    },
  },
  {
    // Data rules stay DOM-free so they can be unit tested.
    files: ['src/logic/**/*.ts'],
    languageOptions: { globals: {} },
  },
  {
    files: ['scripts/**/*.js', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
