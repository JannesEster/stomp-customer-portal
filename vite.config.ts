import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages serves the site from /stomp-customer-portal/ rather than the domain root.
  base: mode === 'pages' ? '/stomp-customer-portal/' : '/',
  server: {
    open: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/healthz': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
}));
