import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * `app.json` is the app's config; this only adds what depends on a file
 * being there. Firebase's `google-services.json` (Android notifications) is
 * named only once it has been downloaded into this folder — naming a file
 * that isn't there fails every build — so the app builds without it, just
 * without notifications on Android.
 *
 * `google-services.json` identifies the Firebase project and is meant to ship
 * inside the app, so it is committed. The service account key that lets Expo
 * send through it is not: that one goes to `eas credentials`, never here.
 */
const googleServices = join(__dirname, "google-services.json");

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    ...(existsSync(googleServices) ? { googleServicesFile: "./google-services.json" } : {}),
  },
});
