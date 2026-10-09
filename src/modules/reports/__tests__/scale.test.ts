import { niceTicks } from "../scale";

describe("niceTicks", () => {
  it("lands on round 100k steps for a max in that range", () => {
    // What the dashboard's own numbers would have produced: a period maxing
    // out a little under half a million.
    expect(niceTicks(480_000)).toEqual([0, 100_000, 200_000, 300_000, 400_000, 500_000]);
  });

  it("never stops short of the data's own max", () => {
    const ticks = niceTicks(734_521);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(734_521);
  });

  it("always starts at zero", () => {
    expect(niceTicks(123)[0]).toBe(0);
  });

  it("scales down for a small company's figures, not just a big one's", () => {
    expect(niceTicks(420)).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it("rounds to 2/5/10 as well as 1, whichever is closest without falling short", () => {
    expect(niceTicks(1_900_000)).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000]);
    expect(niceTicks(950_000)).toEqual([0, 200_000, 400_000, 600_000, 800_000, 1_000_000]);
  });

  it("is a flat zero line rather than throwing on an empty period", () => {
    expect(niceTicks(0)).toEqual([0]);
  });

  it("respects a different target count", () => {
    expect(niceTicks(1_000_000, 2)).toEqual([0, 500_000, 1_000_000]);
  });
});
