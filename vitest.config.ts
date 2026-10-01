import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/shared/tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    // Vite matches the first alias whose key is a prefix of the import, testing
    // an exact match first and then `key + '/'`. So `@neurobook/shared/ledger`
    // IS matched by the `@neurobook/shared` entry, and would resolve to
    // `src/shared/index.ts/ledger`. The sub-path keys therefore have to be
    // listed before the base key — the same longest-prefix rule the Turbopack
    // aliases in next.config.ts rely on.
    alias: {
      '@': resolve(__dirname, './src'),
      '@neurobook/shared/ledger': resolve(__dirname, './src/shared/ledger'),
      '@neurobook/shared/auth': resolve(__dirname, './src/shared/auth'),
      '@neurobook/shared/format': resolve(__dirname, './src/shared/format'),
      '@neurobook/shared/env': resolve(__dirname, './src/shared/env.ts'),
      '@neurobook/shared': resolve(__dirname, './src/shared/index.ts'),
    },
  },
})
