import type { Config } from "tailwindcss";
import { nativeTheme } from "@nodo/tokens/native";

/**
 * The theme is packages/tokens', the same one the web's `tokens.css` is
 * generated from: `bg-card`, `text-callout` and `rounded-xl` mean the same on
 * both sides. Colours are CSS variables, set at the root by `BrandRoot`.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  // The preset ships CommonJS with no module types; `require` is how it is meant to load.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  presets: [require("nativewind/preset")],
  theme: { extend: nativeTheme },
} satisfies Config;
