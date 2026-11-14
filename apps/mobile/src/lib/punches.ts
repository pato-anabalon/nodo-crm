import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api, ApiError, type Auth } from "./api";
import { withoutRefused, type Punch } from "./clock";

/**
 * Punches waiting for signal. A punch is kept on the phone the moment the
 * button is pressed — its time, its fix, its own id — and sent in order until
 * the server has it; the server answers a punch sent twice with what the first
 * one made, so sending again after a dropped answer is always safe.
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

async function send(punch: Punch, auth: Auth) {
  if (punch.kind === "in") {
    const { kind: _kind, jobName: _jobName, ...body } = punch;
    await api("/timeclock/clock-in", { method: "POST", auth, body });
  } else {
    const { kind: _kind, ...body } = punch;
    await api("/timeclock/clock-out", { method: "POST", auth, body });
  }
}

/**
 * Sends what is waiting, oldest first, one at a time — a clock-out must never
 * arrive before the clock-in it ends. Stops at the first punch that can't
 * reach the server.
 */
async function flush(key: string, auth: Auth, onSent: () => void) {
  await load(key);
  if (read(key).sending) return;
  write(key, { sending: true });
  let sent = false;
  try {
    while (read(key).punches.length > 0) {
      const punch = read(key).punches[0];
      try {
        await send(punch, auth);
        write(key, { punches: read(key).punches.slice(1) }, true);
        sent = true;
      } catch (error) {
        const reachable = error instanceof ApiError && error.status !== 0 && error.status < 500 && error.status !== 401;
        if (!reachable) break;
        write(key, { punches: withoutRefused(read(key).punches, punch), refusal: { code: error.code, extra: error.extra } }, true);
        sent = true;
      }
    }
  } finally {
    write(key, { sending: false });
    if (sent) onSent();
  }
}

/** How often to try again while something waits: a site comes back into signal on its own. */
const RETRY_MS = 30_000;

/**
 * The queue for this person in this company. `onSent` is called once the
 * server has heard something, so the screen can read what it now says.
 */
export function usePunchQueue(auth: Auth & { company: string }, userId: string | undefined, onSent: () => void) {
  const key = userId ? `${auth.company}:${userId}` : null;
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (key ? read(key) : EMPTY),
  );

  const trySend = useCallback(() => {
    if (key) void flush(key, auth, onSent);
  }, [key, auth, onSent]);

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
      if (!key) return;
      write(key, { punches: [...read(key).punches, punch], refusal: null }, true);
      trySend();
    },
    dismissRefusal() {
      if (key) write(key, { refusal: null });
    },
    retry: trySend,
  };
}
