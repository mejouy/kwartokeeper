import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build output (android/ holds a copy of the built web app) and an empty leftover file
  globalIgnores(['dist', 'android', 'ios', '**/node_modules', 'their_version.jsx']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Code that runs in Node, not the browser: Cloud Functions, scripts, tests
  {
    files: ['functions/**/*.js', 'scripts/**/*.{js,cjs,mjs}', 'tests/**/*.{js,mjs}', '**/*.cjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
  {
    files: ['tests/**/*.{js,mjs}', 'scripts/**/*.mjs'],
    languageOptions: { sourceType: 'module' },
  },
  {
    files: ['src/**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
])
