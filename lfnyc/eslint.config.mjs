import astro from 'eslint-plugin-astro';
import tsParser from '@typescript-eslint/parser';
export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'public/**',
      '.netlify/**',
    ],
  },
  ...astro.configs.recommended,
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  {
    files: ['**/*.{js,mjs,ts,astro}'],
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
