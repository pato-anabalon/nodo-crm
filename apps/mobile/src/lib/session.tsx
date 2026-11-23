import Constants from "expo-constants";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { api, ApiError, type Auth } from "./api";
import { persister, queryClient, whenUnauthenticated } from "./query";
import { pickCompany } from "./session-rules";
import { storage } from "./storage";
import { stopTracking } from "./tracking";
import type { CompanyChoice, SignInResult } from "./types";

/**
 * Who is signed in, and where they are working. Four states, and the
 * navigator shows one stack per state: signed out, waiting for the emailed
 * code, signed in without a company yet, and working in one.
 */
export type SessionState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "code"; challengeId: string; email: string }
  | { status: "signedIn"; token: string; company: string | null; companies: CompanyChoice[] | null };

type Session = {
  state: SessionState;
  auth: Auth | null;
  signIn(email: string, password: string): Promise<void>;
  verifyCode(code: string, trustDevice: boolean): Promise<void>;
  restart(): void;
  chooseCompany(slug: string): Promise<void>;
  leaveCompany(): Promise<void>;
  signOut(): Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession outside SessionProvider");
  return session;
}

/** For screens inside a company, where there always is one. */
export function useAuth(): Auth & { company: string } {
  const { auth } = useSession();
  if (!auth?.company) throw new Error("useAuth outside a company");
  return auth as Auth & { company: string };
}

async function device() {
  return {
    deviceId: await storage.deviceId(),
    deviceName: Constants.deviceName ?? undefined,
    platform: Platform.OS === "ios" ? ("ios" as const) : ("android" as const),
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const forget = useCallback(async () => {
    await stopTracking();
    await storage.clear();
    queryClient.clear();
    await persister.removeClient();
    setState({ status: "signedOut" });
  }, []);

  useEffect(() => whenUnauthenticated(() => void forget()), [forget]);

  // Opening the app: a stored session is asked where it may work today. With
  // no signal it opens where it was, on what the phone already has.
  useEffect(() => {
    void (async () => {
      const [token, stored] = await Promise.all([storage.token(), storage.company()]);
      if (!token) return setState({ status: "signedOut" });
      try {
        const { companies } = await api<{ companies: CompanyChoice[] }>("/companies", { auth: { token } });
        const company = pickCompany(companies, stored);
        await storage.setCompany(company);
        setState({ status: "signedIn", token, company, companies });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return forget();
        setState({ status: "signedIn", token, company: stored, companies: null });
      }
    })();
  }, [forget]);

  const begin = useCallback(async (token: string, companies: CompanyChoice[]) => {
    const company = pickCompany(companies, null);
    await Promise.all([storage.setToken(token), storage.setCompany(company)]);
    setState({ status: "signedIn", token, company, companies });
  }, []);

  const session = useMemo<Session>(() => {
    const auth = state.status === "signedIn" ? { token: state.token, company: state.company } : null;
    return {
      state,
      auth,
      async signIn(email, password) {
        const result = await api<SignInResult>("/auth/password", {
          method: "POST",
          body: { email, password, ...(await device()) },
        });
        if (result.kind === "session") return begin(result.token, result.companies);
        setState({ status: "code", challengeId: result.challengeId, email: result.email });
      },
      async verifyCode(code, trustDevice) {
        if (state.status !== "code") return;
        const result = await api<SignInResult & { kind: "session" }>("/auth/code", {
          method: "POST",
          body: { challengeId: state.challengeId, code, trustDevice, ...(await device()) },
        });
        await begin(result.token, result.companies);
      },
      restart: () => setState({ status: "signedOut" }),
      async chooseCompany(slug) {
        if (state.status !== "signedIn") return;
        await storage.setCompany(slug);
        setState({ ...state, company: slug });
      },
      async leaveCompany() {
        if (state.status !== "signedIn") return;
        await storage.setCompany(null);
        setState({ ...state, company: null });
      },
      async signOut() {
        // Revoking on the server is the point, but a phone with no signal can
        // still forget the session; the token is useless once it's gone from here.
        if (auth) await api("/auth/sign-out", { method: "POST", auth }).catch(() => undefined);
        await forget();
      },
    };
  }, [state, begin, forget]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
