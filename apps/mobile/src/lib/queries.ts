import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./session";
import { markRead } from "./inbox";
import { tickInLists, tickTodo } from "./todos";
import type { ActivityRow, Inbox, JobDetail, JobList, Me, TodoDetail, TodoList } from "./types";

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

export function useJob(id: string) {
  const auth = useAuth();
  return useQuery({
    queryKey: [auth.company, "job", id],
    queryFn: ({ signal }) => api<JobDetail>(`/jobs/${id}`, { auth, signal }),
  });
}

/** What may be done on this job — the job's own context, not the profile's in general. */
export function canOn(job: JobDetail | undefined, permission: string): boolean {
  return job?.permissions.includes(permission) ?? false;
}

export function useActivity(jobId: string) {
  const auth = useAuth();
  return useQuery({
    queryKey: [auth.company, "job", jobId, "activity"],
    queryFn: ({ signal }) => api<{ activity: ActivityRow[] }>(`/jobs/${jobId}/activity`, { auth, signal }),
  });
}

export function useTodoLists(jobId: string) {
  const auth = useAuth();
  return useQuery({
    queryKey: [auth.company, "job", jobId, "todos"],
    queryFn: ({ signal }) => api<{ lists: TodoList[] }>(`/jobs/${jobId}/todos`, { auth, signal }),
  });
}

export function useTodo(id: string) {
  const auth = useAuth();
  return useQuery({
    queryKey: [auth.company, "todo", id],
    queryFn: ({ signal }) => api<{ todo: TodoDetail }>(`/todos/${id}`, { auth, signal }),
  });
}

/**
 * Ticking off. The box answers the moment it's pressed, here and on the list
 * the to-do sits in; the server is sent the state wanted, so a retry after a
 * dropped connection can't undo the first press. Refused, it goes back.
 */
export function useSetDone(jobId: string) {
  const auth = useAuth();
  const client = useQueryClient();
  const listsKey = [auth.company, "job", jobId, "todos"];
  const todoKey = (id: string) => [auth.company, "todo", id];

  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api<{ done: boolean; changed: boolean }>(`/todos/${id}/completion`, { method: "PUT", body: { done }, auth }),
    onMutate: async ({ id, done }) => {
      await Promise.all([client.cancelQueries({ queryKey: listsKey }), client.cancelQueries({ queryKey: todoKey(id) })]);
      const lists = client.getQueryData<{ lists: TodoList[] }>(listsKey);
      const todo = client.getQueryData<{ todo: TodoDetail }>(todoKey(id));
      if (lists) client.setQueryData(listsKey, { lists: tickInLists(lists.lists, id, done) });
      if (todo) client.setQueryData(todoKey(id), { todo: tickTodo(todo.todo, done) });
      return { lists, todo };
    },
    onError: (_error, { id }, context) => {
      if (context?.lists) client.setQueryData(listsKey, context.lists);
      if (context?.todo) client.setQueryData(todoKey(id), context.todo);
    },
    onSettled: (_data, _error, { id }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: listsKey }),
        client.invalidateQueries({ queryKey: todoKey(id) }),
        client.invalidateQueries({ queryKey: [auth.company, "job", jobId, "activity"] }),
      ]),
  });
}

export type TodoInput = {
  title?: string;
  notes?: string;
  startsOn?: string | null;
  dueOn?: string | null;
  assigneeIds?: string[];
};

/** A new to-do at the bottom of a list, or the fields of one that changed — only those are sent. */
export function useSaveTodo(jobId: string) {
  const auth = useAuth();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: { listId: string; todoId?: undefined; values: TodoInput } | { todoId: string; values: TodoInput }) =>
      "listId" in input
        ? api<{ id: string }>(`/todo-lists/${input.listId}/todos`, { method: "POST", body: input.values, auth })
        : api<{ id: string }>(`/todos/${input.todoId}`, { method: "PATCH", body: input.values, auth }),
    onSuccess: ({ id }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: [auth.company, "job", jobId] }),
        client.invalidateQueries({ queryKey: [auth.company, "todo", id] }),
      ]),
  });
}

export function useAddTodoComment(todoId: string) {
  const auth = useAuth();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => api<{ id: string }>(`/todos/${todoId}/comments`, { method: "POST", body: { body }, auth }),
    onSuccess: () => client.invalidateQueries({ queryKey: [auth.company, "todo", todoId] }),
  });
}
