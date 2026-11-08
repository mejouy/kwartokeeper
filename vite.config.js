import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Unit tests (npm test). The database rules have their own tests: npm run test:rules
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
  base: './',
})
