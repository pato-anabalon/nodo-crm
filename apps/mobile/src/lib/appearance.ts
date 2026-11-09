import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Appearance } from "react-native";

/**
 * Light, dark, or whatever the phone is set to — the person's choice for this
 * phone, as the web keeps it per browser. Applied through `Appearance`, so
 * `useColorScheme` (and with it the palette, the headers and the status bar)
 * follows without anything else knowing there is a choice.
 */
export type AppearanceChoice = "system" | "light" | "dark";

const KEY = "nodo.appearance";
const CHOICES: AppearanceChoice[] = ["system", "light", "dark"];

function apply(choice: AppearanceChoice) {
  Appearance.setColorScheme(choice === "system" ? "unspecified" : choice);
}

/** Read once at start-up; until it answers, the phone's own setting. */
export async function restoreAppearance() {
  const stored = await AsyncStorage.getItem(KEY).catch(() => null);
  if (stored && (CHOICES as string[]).includes(stored)) apply(stored as AppearanceChoice);
}

export function useAppearance() {
  const [choice, setChoice] = useState<AppearanceChoice>("system");

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((stored) => {
      if (stored && (CHOICES as string[]).includes(stored)) setChoice(stored as AppearanceChoice);
    });
  }, []);

  const choose = (next: AppearanceChoice) => {
    setChoice(next);
    apply(next);
    void AsyncStorage.setItem(KEY, next);
  };

  return { choice, choose, choices: CHOICES };
}
