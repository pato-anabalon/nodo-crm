import type en from "@nodo/messages/en-GB.json";

/**
 * The messages' own shape, so a key that doesn't exist fails the typecheck
 * rather than rendering its own name on somebody's phone. Arguments aren't
 * checked: imported from JSON, every message is just a `string` to TypeScript.
 */
declare module "use-intl" {
  interface AppConfig {
    Messages: typeof en;
    Locale: "en-GB" | "es";
  }
}
