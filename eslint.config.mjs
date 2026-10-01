import next from 'eslint-config-next'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...next,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/.next/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/expo-env.d.ts',
      'apps/mobile/.expo/**',
    ],
  },
)
