import astro from 'eslint-plugin-astro';
import tsParser from '@typescript-eslint/parser';
export default [
  {
    ignores: [
      'dist/**',
      '.server/**',
      '.astro/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'public/**',
      '.netlify/**',
    ],
  },
  ...astro.configs.recommended,
  { files: ['**/*.{ts,mts}'], languageOptions: { parser: tsParser } },
  {
    files: ['**/*.{js,mjs,ts,mts,astro}'],
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
