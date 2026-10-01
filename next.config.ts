import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // Next.js 16: reactCompiler moved out of `experimental` to top-level.
  // Enables automatic memoization; drop useMemo/useCallback where it appears.
  reactCompiler: true,
  serverExternalPackages: ['argon2'],
  turbopack: {
    resolveAlias: {
      // The old @neurobook/shared workspace package is now a plain folder
      // (src/shared). Turbopack does not read tsconfig `paths`, so alias the
      // import specifiers to the folder directly. Sub-path keys win over the
      // base key by longest-prefix match. Use forward-slash relative paths —
      // absolute Windows backslash targets do not re-resolve.
      '@neurobook/shared/ledger': './src/shared/ledger',
      '@neurobook/shared/auth': './src/shared/auth',
      '@neurobook/shared/format': './src/shared/format',
      '@neurobook/shared/env': './src/shared/env.ts',
      '@neurobook/shared': './src/shared',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default config
