import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryCache, QueryClient, MutationCache } from "@tanstack/react-query";
import { ApiError } from "./api";

/**
 * One client for the app's lifetime. What it fetched is kept on the phone, so
 * a job opened yesterday still opens in a basement with no signal; every key
 * starts with the company's slug, so switching company never shows the
 * previous one's data, and signing out clears the lot.
 *
 * A 401 from any request means the session is over — revoked from another
 * phone, or past its 90 days — and is handed to whoever signed in.
 */
let onUnauthenticated: () => void = () => {};
export const whenUnauthenticated = (handler: () => void) => {
  onUnauthenticated = handler;
};

const expired = (error: unknown) => {
  if (error instanceof ApiError && error.status === 401) onUnauthenticated();
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: expired }),
  mutationCache: new MutationCache({ onError: expired }),
  defaultOptions: {
    queries: {
      // A day: what's on the phone is worth showing while the fresh copy comes.
      gcTime: 24 * 60 * 60 * 1000,
      staleTime: 30 * 1000,
      // No signal is not worth three retries; a refusal is never worth one.
      retry: (failures, error) => error instanceof ApiError && error.status === 0 && failures < 1,
    },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "nodo.queries" });
