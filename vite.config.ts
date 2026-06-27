/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Unit tests are co-located under src/; e2e/ is Playwright-only and must
    // not be collected by vitest (it imports @playwright/test).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    execArgv: ['--localstorage-file=.vitest-localstorage'],
  },
});
