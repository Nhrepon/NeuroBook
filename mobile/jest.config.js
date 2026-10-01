// jest-expo preset + our monorepo.
//
// 1. `expo-modules-core` is installed nested under
//    `node_modules/expo/node_modules/expo-modules-core` (npm refuses to
//    hoist it because of the react-native-worklets peer range). jest-expo's
//    preset/setup.js does `require('expo-modules-core')` from its own
//    location, so we expose the nested dir to jest-resolve via
//    `modulePaths`.
//
// 2. `@neurobook/shared` is a workspace package (TS source, no build
//    step). jest-resolve follows the `node_modules/@neurobook/shared`
//    symlink and reports a node_modules path that matches
//    `transformIgnorePatterns` → raw ESM → "Cannot use import statement
//    outside a module". We map each subpath to the .ts source file.
const path = require('path')

const sharedSrc = path.resolve(__dirname, '../../packages/shared/src')

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  modulePaths: [
    path.resolve(__dirname, '../../node_modules/expo/node_modules'),
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@neurobook/shared$': sharedSrc + '/index.ts',
    '^@neurobook/shared/ledger$': sharedSrc + '/ledger/index.ts',
    '^@neurobook/shared/auth$': sharedSrc + '/auth/index.ts',
    '^@neurobook/shared/format$': sharedSrc + '/format/index.ts',
    '^@neurobook/shared/money$': sharedSrc + '/money.ts',
    '^@neurobook/shared/types$': sharedSrc + '/types.ts',
    '^@neurobook/shared/schemas$': sharedSrc + '/schemas.ts',
    '^@neurobook/shared/env$': sharedSrc + '/env.ts',
    '^@neurobook/shared/id$': sharedSrc + '/id.ts',
  },
}
