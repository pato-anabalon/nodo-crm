import "../../global.css";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BrandRoot } from "@/lib/brand";
import { deviceLocale, I18n } from "@/lib/i18n";
import { persister, queryClient } from "@/lib/query";
import { useMe } from "@/lib/queries";
import { SessionProvider, useSession } from "@/lib/session";
import { Loading } from "@/components/screen";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000 }}>
          <SessionProvider>
            <Shell />
          </SessionProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * One stack per state of the session, so nothing has to redirect by hand:
 * signing in, the code, choosing a company, and the tabs. Inside a company the
 * brand and the language are that company's and that person's (`/me`).
 */
function Shell() {
  const { state } = useSession();
  const signedIn = state.status === "signedIn";
  const inCompany = signedIn && !!state.company;

  if (state.status === "loading") {
    return (
      <Chrome>
        <Loading />
      </Chrome>
    );
  }

  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
      <Stack.Protected guard={state.status === "signedOut"}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === "code"}>
        <Stack.Screen name="code" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !state.company}>
        <Stack.Screen name="companies" />
      </Stack.Protected>
      <Stack.Protected guard={inCompany}>
        <Stack.Screen name="(company)" />
      </Stack.Protected>
    </Stack>
  );

  return inCompany ? <CompanyChrome>{stack}</CompanyChrome> : <Chrome>{stack}</Chrome>;
}

function Chrome({ children }: { children: ReactNode }) {
  return (
    <I18n locale={deviceLocale()}>
      <BrandRoot>
        <StatusBar style="auto" />
        {children}
      </BrandRoot>
    </I18n>
  );
}

/** Until `/me` answers the first time, the phone's language and Nodo's colour; after that, the cached copy. */
function CompanyChrome({ children }: { children: ReactNode }) {
  const { data: me } = useMe();

  return (
    <I18n locale={me?.locale ?? deviceLocale()} timeZone={me?.company.timezone}>
      <BrandRoot primary={me?.company.primaryColor} accent={me?.company.accentColor}>
        <StatusBar style="auto" />
        {children}
      </BrandRoot>
    </I18n>
  );
}
