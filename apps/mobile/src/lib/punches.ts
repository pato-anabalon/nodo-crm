import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api, ApiError, type Auth } from "./api";
import { nextBatch, withoutRefused, type Punch } from "./clock";

/**
 * Punches waiting for signal. A punch is kept on the phone the moment the
 * button is pressed — its time, its fix, its own id — and sent in order until
 * the server has it; the server answers a punch sent twice with what the first
 * one made, so sending again after a dropped answer is always safe. Leaving
 * and coming back to the job go in the same queue, from the background task
 * as much as from the screen: travel takes its start from the departure, so
 * the departure has to arrive first.
 *
 * Kept per company and per person: a phone handed to somebody else must never
 * send the last person's punches under the new person's session.
 *
 * A refusal (away from the job, consent gone, a finished job) takes the punch
 * off the queue and is kept to be said on screen; no signal leaves it there
 * for the next try.
 */

export type Refusal = { code: string; extra: Record<string, unknown> };
type State = { punches: Punch[]; refusal: Refusal | null; sending: boolean; loaded: boolean };

const EMPTY: State = { punches: [], refusal: null, sending: false, loaded: false };
const states = new Map<string, State>();
const listeners = new Set<() => void>();
/** Screens that read the clock, told when the server has heard something whoever sent it. */
const sentListeners = new Set<() => void>();
const storageKey = (key: string) => `nodo.punches.${key}`;

function read(key: string): State {
  return states.get(key) ?? EMPTY;
}

function write(key: string, next: Partial<State>, persist = false) {
  const state = { ...read(key), ...next };
  states.set(key, state);
  listeners.forEach((listener) => listener());
  if (persist) void AsyncStorage.setItem(storageKey(key), JSON.stringify(state.punches));
}

async function load(key: string) {
  if (read(key).loaded) return;
  const raw = await AsyncStorage.getItem(storageKey(key)).catch(() => null);
  const punches = raw ? (JSON.parse(raw) as Punch[]) : [];
  // Anything queued before loading finished goes after what was already saved.
  write(key, { punches: [...punches, ...read(key).punches], loaded: true });
}

async function send(batch: Punch[], auth: Auth) {
  const punch = batch[0];
  switch (punch.kind) {
    case "in": {
      const { kind: _kind, jobName: _jobName, ...body } = punch;
      return api("/timeclock/clock-in", { method: "POST", auth, body });
    }
    case "out": {
      const { kind: _kind, ...body } = punch;
      return api("/timeclock/clock-out", { method: "POST", auth, body });
    }
    case "event":
      return api("/timeclock/events", {
        method: "POST",
        auth,
        body: { entry: punch.entry, events: batch.flatMap((event) => (event.kind === "event" ? [{ clientId: event.clientId, kind: event.event, at: event.at }] : [])) },
      });
    case "travel": {
      const { kind: _kind, ...body } = punch;
      return api("/timeclock/travel", { method: "POST", auth, body });
    }
    case "switch": {
      const { kind: _kind, jobName: _jobName, ...body } = punch;
      return api("/timeclock/switch", { method: "POST", auth, body });
    }
  }
}

/**
 * Sends what is waiting, oldest first, one at a time — a clock-out must never
 * arrive before the clock-in it ends. Stops at the first punch that can't
 * reach the server.
 */
export async function flushPunches(key: string, auth: Auth): Promise<void> {
  await load(key);
  if (read(key).sending) return;
  write(key, { sending: true });
  let sent = false;
  try {
    while (read(key).punches.length > 0) {
      const batch = nextBatch(read(key).punches);
      try {
        await send(batch, auth);
        write(key, { punches: read(key).punches.filter((punch) => !batch.includes(punch)) }, true);
        sent = true;
      } catch (error) {
        const reachable = error instanceof ApiError && error.status !== 0 && error.status < 500 && error.status !== 401;
        if (!reachable) break;
        let rest = read(key).punches;
        for (const punch of batch) rest = withoutRefused(rest, punch);
        // A departure nobody pressed for isn't worth a red box: only what a person did is said.
        const said = batch[0].kind === "event" && batch[0].event !== "ERRAND" ? null : { code: error.code, extra: error.extra };
        write(key, { punches: rest, refusal: said ?? read(key).refusal }, true);
        sent = true;
      }
    }
  } finally {
    write(key, { sending: false });
    if (sent) sentListeners.forEach((listener) => listener());
  }
}

/** Adds to the queue of this person in this company — from a screen or from the background — and tries to send it. */
export async function enqueuePunch(key: string, punch: Punch, auth: Auth | null): Promise<void> {
  await load(key);
  write(key, { punches: [...read(key).punches, punch], refusal: null }, true);
  if (auth) await flushPunches(key, auth);
}

/** Whether anything waits: positions go up only after the shift they belong to has. */
export async function punchesWaiting(key: string): Promise<boolean> {
  await load(key);
  return read(key).punches.length > 0;
}

export const punchKey = (company: string, userId: string) => `${company}:${userId}`;

/** How often to try again while something waits: a site comes back into signal on its own. */
const RETRY_MS = 30_000;

/**
 * The queue for this person in this company. `onSent` is called once the
 * server has heard something, so the screen can read what it now says.
 */
export function usePunchQueue(auth: Auth & { company: string }, userId: string | undefined, onSent: () => void) {
  const key = userId ? punchKey(auth.company, userId) : null;
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (key ? read(key) : EMPTY),
  );

  const trySend = useCallback(() => {
    if (key) void flushPunches(key, auth);
  }, [key, auth]);

  useEffect(() => {
    sentListeners.add(onSent);
    return () => {
      sentListeners.delete(onSent);
    };
  }, [onSent]);

  useEffect(() => {
    if (!key) return;
    void load(key).then(trySend);
    const subscription = AppState.addEventListener("change", (next) => next === "active" && trySend());
    return () => subscription.remove();
  }, [key, trySend]);

  const waiting = state.punches.length > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(trySend, RETRY_MS);
    return () => clearInterval(timer);
  }, [waiting, trySend]);

  return {
    punches: state.punches,
    refusal: state.refusal,
    sending: state.sending,
    enqueue(punch: Punch) {
      if (key) void enqueuePunch(key, punch, auth);
    },
    dismissRefusal() {
      if (key) write(key, { refusal: null });
    },
    retry: trySend,
  };
}
