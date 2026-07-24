import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests cover the pure domain logic (diff, migration, validation). These modules
// have only type-only imports, so the suite runs without touching the database.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
