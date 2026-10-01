// Expo SDK 57 + RN 0.86.
//
// - `babel-preset-expo` is the base preset (Metro, jest-expo, web).
// - `react-native-worklets/plugin` is required for reanimated v4 worklets.
// - `nativewind/babel` is intentionally NOT included: in nativewind 4.x it
//   conflicts with Metro's transform pipeline (BABEL_UNKNOWN_PLUGIN_PROPERTY
//   in SDK 57). Nativewind's className support comes through its Metro
//   preset, not the babel plugin.
const isTest =
  process.env.BABEL_ENV === 'test' || process.env.NODE_ENV === 'test'

module.exports = {
  presets: ['babel-preset-expo'],
  plugins: isTest
    ? []
    : ['react-native-worklets/plugin'],
}
