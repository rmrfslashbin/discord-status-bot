import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.test.js',
        '**/*.spec.js',
        '**/*.config.js',
        'register.js',
        'coverage/**',
        '.wrangler/**',
      ],
    },
    testMatch: [
      '**/tests/**/*.test.js',
      '**/tests/**/*.spec.js',
      '**/__tests__/**/*.js',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'build',
      '.wrangler',
    ],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})