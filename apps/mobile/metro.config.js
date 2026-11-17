const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/**
 * Expo finds the workspace root on its own; NativeWind compiles `global.css`.
 * A rem is 16 here as on the web (NativeWind's default is 14), so `min-h-12`
 * is the same 48 on both sides.
 */
module.exports = withNativeWind(getDefaultConfig(__dirname), { input: "./global.css", inlineRem: 16 });
