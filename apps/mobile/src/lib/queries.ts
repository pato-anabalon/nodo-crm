import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./session";
import { markRead } from "./inbox";
import type { Inbox, JobList, Me } from "./types";

/**
 * Every query is keyed by the company first, so switching company can't show
 * the previous one's jobs, and `/me` — the brand, the language, the
 * permissions — is cached like anything else and the app opens branded
 * without waiting for the network.
 */

export function useMe() {
  const auth = useAuth();
  return useQuery({ queryKey: [auth.company, "me"], queryFn: ({ signal }) => api<Me>("/me", { auth, signal }) });
}

export function can(me: Me | undefined, permission: string): boolean {
  return me?.permissions.includes(permission) ?? false;
}

export function useJobs(show: "active" | "done") {
  const auth = useAuth();
  return useQuery({
    queryKey: [auth.company, "jobs", show],
    queryFn: ({ signal }) => api<JobList>(`/jobs?show=${show}`, { auth, signal }),
  });
}

export function useInbox() {
  const auth = useAuth();
  return useQuery({
    queryKey: [auth.company, "notifications"],
    queryFn: ({ signal }) => api<Inbox>("/notifications", { auth, signal }),
    // The bell is the one thing worth asking for while the app sits open.
    refetchInterval: 60 * 1000,
  });
}

export function useMarkRead() {
  const auth = useAuth();
  const client = useQueryClient();
  const key = [auth.company, "notifications"];

  return useMutation({
    mutationFn: (id: string | "all") =>
      api(id === "all" ? "/notifications/read-all" : `/notifications/${id}/read`, { method: "POST", auth }),
    // The dot goes the moment it's pressed; the server's answer only confirms it.
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<Inbox>(key);
      if (before) client.setQueryData<Inbox>(key, markRead(before, id));
      return { before };
    },
    onError: (_error, _id, context) => context?.before && client.setQueryData(key, context.before),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}
