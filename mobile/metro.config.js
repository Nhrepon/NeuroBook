// Metro config for Expo SDK 57 + monorepo.
//
// `disableHierarchicalLookup` was the historical fix for the "Invalid hook
// call" issue from two React copies. With npm workspaces + Expo 57, the
// right combination is:
//
//   1. Resolutions at the root `package.json` (one React, one RN).
//   2. Metro walks the symlinked workspaces via `watchFolders` and the
//      `unstable_enableSymlinks` flag (on by default in SDK 57).
//   3. A short `nodeModulesPaths` list so package roots are unambiguous.
//
// Keeping `disableHierarchicalLookup = false` lets Metro follow symlinks
// and find package internals (e.g. expo-sqlite's WASM) without us having
// to enumerate every nested `node_modules` directory.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx']
// expo-sqlite's web worker loads a WASM file via `import "./wa-sqlite/wa-sqlite.wasm"`.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm')
}

// `unstable_enableSymlinks` is on by default in SDK 57; the line below is
// kept as documentation and a safety pin for older runtimes.
config.resolver.unstable_enableSymlinks =
  config.resolver.unstable_enableSymlinks ?? true

module.exports = config
