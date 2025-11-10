import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true,
      },
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'text-summary'],
      reportOnFailure: true,
      lines: 85,
      functions: 85,
      branches: 80,
      statements: 85,
      exclude: [
        'node_modules/',
        'dist/',
        'benches/',
        '**/node_modules/**',
        '**/*.bench.ts',
        '**/*.test.utils.ts',
      ],
    },

    // Test file patterns
    include: ['tests/**/*.test.ts', 'benches/**/*.bench.ts'],
    exclude: ['node_modules', 'dist', 'build', '.idea', '.git', '.cache'],

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Reporters
    reporters: ['default', 'html', 'json'],

    // Output configuration
    outputFile: {
      html: './test-results/index.html',
      json: './test-results/results.json',
    },

    // Logging
    singleThread: false,
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    // Snapshot configuration
    snapshotFormat: {
      printBasicPrototype: false,
    },
  },

  resolve: {
    alias: {
      '@qudag/napi-core': path.resolve(__dirname, './packages/napi-core'),
      '@qudag/cli': path.resolve(__dirname, './packages/cli'),
      '@qudag/mcp-stdio': path.resolve(__dirname, './packages/mcp-stdio'),
      '@qudag/mcp-sse': path.resolve(__dirname, './packages/mcp-sse'),
      '@tests': path.resolve(__dirname, './tests'),
      '@utils': path.resolve(__dirname, './tests/utils'),
    },
  },
});
