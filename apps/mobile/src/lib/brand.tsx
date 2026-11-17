import { brandVars } from "@nodo/tokens/brand";
import { colorVars } from "@nodo/tokens/native";
import { vars } from "nativewind";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme, View } from "react-native";

/**
 * The company's colour over the tokens, the way the web's `BrandTheme` does it:
 * every colour is a variable, and the root replaces the few the brand owns —
 * including `--brand-ink`, worked out against this scheme's card. With no
 * company yet (signing in) it is Nodo's own palette.
 */
type Palette = Record<`--${string}`, string>;

const PaletteContext = createContext<Palette>(colorVars("light"));

export function BrandRoot({ primary, accent, children }: { primary?: string; accent?: string; children: ReactNode }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const palette = useMemo(
    () => colorVars(scheme, primary ? brandVars(primary, accent ?? null, "hex") : null),
    [primary, accent, scheme],
  );
  const style = useMemo(() => vars(palette), [palette]);

  return (
    <PaletteContext.Provider value={palette}>
      <View style={style} className="flex-1 bg-background">
        {children}
      </View>
    </PaletteContext.Provider>
  );
}

/** For what takes a colour as a prop rather than a class: icons, the tab bar, a spinner. */
export function useColor(name: string): string {
  return useContext(PaletteContext)[`--${name}`];
}
