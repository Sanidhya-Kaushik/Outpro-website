// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/**',
        'src/server.ts',         // Entry point — tested via integration
        'src/config/migrate.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
    // Increase timeout for integration tests hitting in-memory DB mocks
    testTimeout: 15_000,
    hookTimeout: 10_000,
    // Run tests sequentially to avoid mock state collisions
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
