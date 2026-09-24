import { acceptedKey, celebrate } from "../celebrate";

const fire = jest.fn(() => Promise.resolve());
const create = jest.fn(() => fire);

jest.mock("canvas-confetti", () => ({
  __esModule: true,
  default: { create: (...args: unknown[]) => create(...(args as [])) },
}));

/** jsdom has no matchMedia; every test says explicitly what the person prefers. */
function prefersReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
}

beforeEach(() => {
  fire.mockClear();
  create.mockClear();
  window.localStorage.clear();
  prefersReducedMotion(false);
});

describe("celebrate", () => {
  it("fires, and says that it did", async () => {
    await expect(celebrate({ intensity: "small" })).resolves.toBe(true);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("throws two cannons three times over for the full one", async () => {
    await celebrate();
    expect(fire).toHaveBeenCalledTimes(6);
  });

  /** The lever that decides whether they clear the screen or peter out halfway. */
  it("launches the full one hard enough to leave the bottom of the screen", async () => {
    await celebrate();
    for (const [options] of fire.mock.calls as unknown as Array<[Record<string, number>]>) {
      expect(options.startVelocity).toBeGreaterThan(70);
    }
  });

  it("fires the small one from where it is told, so it lands by the button", async () => {
    const origin = { x: 0.91, y: 0.12 };
    await celebrate({ intensity: "small", origin });
    const [options] = fire.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(options.origin).toEqual(origin);
  });

  it("falls back to the top right, where the actions bar sits", async () => {
    await celebrate({ intensity: "small" });
    const [options] = fire.mock.calls[0] as unknown as [{ origin: { x: number; y: number } }];
    expect(options.origin.x).toBeGreaterThan(0.5);
    expect(options.origin.y).toBeLessThan(0.3);
  });

  /**
   * Not a gentler version — none. For someone who gets motion sickness a
   * smaller swarm of moving particles is still a swarm of moving particles.
   */
  it("does nothing at all when motion is turned down", async () => {
    prefersReducedMotion(true);
    await expect(celebrate()).resolves.toBe(false);
    expect(fire).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("never loads the library when it is not going to fire", async () => {
    prefersReducedMotion(true);
    await celebrate();
    await celebrate({ key: "accepted:q1" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("celebrate: once, not once per visit", () => {
  it("fires the first time and never again for the same key", async () => {
    await expect(celebrate({ key: "accepted:q1" })).resolves.toBe(true);
    await expect(celebrate({ key: "accepted:q1" })).resolves.toBe(false);
    await expect(celebrate({ key: "accepted:q1" })).resolves.toBe(false);
    expect(fire).toHaveBeenCalledTimes(6);
  });

  it("keeps quotes apart", async () => {
    await celebrate({ key: "accepted:q1" });
    await expect(celebrate({ key: "accepted:q2" })).resolves.toBe(true);
  });

  /** The send celebration answers a click, so it is allowed to repeat. */
  it("fires every time when there is no key", async () => {
    await celebrate({ intensity: "small" });
    await celebrate({ intensity: "small" });
    expect(fire).toHaveBeenCalledTimes(2);
  });

  it("still celebrates when storage is unavailable", async () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    await expect(celebrate({ key: "accepted:q1" })).resolves.toBe(true);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

/**
 * Both of these are bugs that shipped and were caught by looking at the running
 * app, not by any check here. They have tests now.
 */
describe("celebrate: the two that got through", () => {
  /**
   * The confetti came out in default blue and green. The tokens are `oklch(…)`
   * and the conversion was giving up on them, so every colour fell back.
   */
  it("wears the company's colour, not the fallback", async () => {
    document.documentElement.style.setProperty("--primary", "oklch(0.4479 0.0707 190.96)");

    await celebrate({ intensity: "small" });

    const [options] = fire.mock.calls[0] as unknown as [{ colors: string[] }];
    expect(options.colors).toContain("#14615e");
    expect(options.colors).not.toContain("#2563eb");

    document.documentElement.style.removeProperty("--primary");
  });

  /**
   * The customer's portal is on the company's own subdomain, so both sides
   * share one `localStorage`. Under a single key, a customer accepting spent
   * the team's celebration before anyone on the team had seen it.
   */
  it("keeps the customer's celebration and the team's apart", async () => {
    const quoteId = "cmu7bx9pf0004d719bfvlaz9q";
    expect(acceptedKey.customer(quoteId)).not.toBe(acceptedKey.staff(quoteId));

    await expect(celebrate({ key: acceptedKey.customer(quoteId) })).resolves.toBe(true);
    await expect(celebrate({ key: acceptedKey.staff(quoteId) })).resolves.toBe(true);

    // And each still only once.
    await expect(celebrate({ key: acceptedKey.staff(quoteId) })).resolves.toBe(false);
  });
});

/**
 * It fires from the Send button, which sits near the top of the window. Aimed
 * upwards — canvas-confetti's default — the confetti left through the top edge
 * almost immediately and was barely seen.
 */
describe("celebrate: the small burst stays on screen", () => {
  it("opens in every direction instead of firing at the ceiling", async () => {
    await celebrate({ intensity: "small" });
    const [options] = fire.mock.calls[0] as unknown as [{ spread: number; angle?: number }];
    expect(options.spread).toBe(360);
  });

  it("is gentle enough not to clear the window it starts near the top of", async () => {
    await celebrate({ intensity: "small" });
    const [options] = fire.mock.calls[0] as unknown as [{ startVelocity: number }];
    expect(options.startVelocity).toBeLessThan(35);
  });

  /** The full one starts at the bottom, where climbing is the whole point. */
  it("leaves the full celebration firing hard from below", async () => {
    await celebrate();
    for (const [options] of fire.mock.calls as unknown as Array<[{ startVelocity: number; origin: { y: number } }]>) {
      expect(options.startVelocity).toBeGreaterThan(70);
      expect(options.origin.y).toBeGreaterThan(0.8);
    }
  });
});
