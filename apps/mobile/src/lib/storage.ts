import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * What survives closing the app. The session token is a bearer credential, so
 * it lives in the Keychain / Keystore and nowhere else; the device id is this
 * install's own random value, which the server hashes to remember a trusted
 * phone; the company is the last one chosen, so the app reopens where it was.
 */
const KEYS = { token: "nodo.session", company: "nodo.company", device: "nodo.device" } as const;

export const storage = {
  token: () => SecureStore.getItemAsync(KEYS.token),
  setToken: (token: string) => SecureStore.setItemAsync(KEYS.token, token),
  company: () => SecureStore.getItemAsync(KEYS.company),
  setCompany: (slug: string | null) =>
    slug ? SecureStore.setItemAsync(KEYS.company, slug) : SecureStore.deleteItemAsync(KEYS.company),
  async clear() {
    await Promise.all([SecureStore.deleteItemAsync(KEYS.token), SecureStore.deleteItemAsync(KEYS.company)]);
  },
  /** Created once per install and kept across sign-outs: it is the phone, not the person. */
  async deviceId(): Promise<string> {
    const existing = await SecureStore.getItemAsync(KEYS.device);
    if (existing) return existing;
    const id = Crypto.randomUUID();
    await SecureStore.setItemAsync(KEYS.device, id);
    return id;
  },
};
