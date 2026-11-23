import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, ApiError, type Auth } from "./api";
import { nextPingBatch, type QueuedPing } from "./movement";
import { punchesWaiting } from "./punches";

/**
 * Positions recorded during a shift by the background task, kept on the phone
 * until they go up in batches (`shouldFlush`). Only once no punch is waiting:
 * a position belongs to a shift the server has to know about first. A batch
 * the server refuses — a shift that never reached it — is dropped; no signal
 * keeps it for next time, and a batch sent twice is stored once.
 *
 * One chain per runtime, so the task and the screen never read and write the
 * list over each other.
 */

const storageKey = (key: string) => `nodo.pings.${key}`;
let chain: Promise<unknown> = Promise.resolve();

function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work, work);
  chain = next.catch(() => undefined);
  return next;
}

async function read(key: string): Promise<QueuedPing[]> {
  const raw = await AsyncStorage.getItem(storageKey(key)).catch(() => null);
  return raw ? (JSON.parse(raw) as QueuedPing[]) : [];
}

const save = (key: string, pings: QueuedPing[]) =>
  pings.length > 0 ? AsyncStorage.setItem(storageKey(key), JSON.stringify(pings)) : AsyncStorage.removeItem(storageKey(key));

/** Adds positions and says how many wait and since when, which is what decides a send. */
export function appendPings(key: string, pings: readonly QueuedPing[]): Promise<{ queued: number; oldestAt: Date | null }> {
  return serial(async () => {
    const all = [...(await read(key)), ...pings];
    await save(key, all);
    return { queued: all.length, oldestAt: all[0] ? new Date(all[0].at) : null };
  });
}

export function flushPings(key: string, auth: Auth): Promise<void> {
  return serial(async () => {
    if (await punchesWaiting(key)) return;
    let queue = await read(key);
    while (queue.length > 0) {
      const batch = nextPingBatch(queue);
      try {
        await api("/timeclock/pings", {
          method: "POST",
          auth,
          body: { entry: batch[0].entry, pings: batch.map(({ entry: _entry, ...ping }) => ping) },
        });
      } catch (error) {
        const refused = error instanceof ApiError && error.status !== 0 && error.status < 500 && error.status !== 401;
        if (!refused) break;
      }
      queue = queue.slice(batch.length);
      await save(key, queue);
    }
  });
}

