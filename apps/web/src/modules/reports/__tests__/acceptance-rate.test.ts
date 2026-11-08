import { acceptanceRate } from "../series";

/**
 * The percentage in the middle of the donut.
 *
 * Pinned against the reference panel's own figures, because the two plausible
 * formulas differ by four points and nothing on screen says which is which.
 */
describe("the donut percentage", () => {
  const accepted = 50212.11;
  const awaiting = 84816.75;
  const declined = 272346.86;

  it("is accepted over all three, which is what the reference shows", () => {
    expect(acceptanceRate(accepted, accepted + awaiting + declined)).toBe(12);
  });

  it("is not accepted over what was answered — that would read 16%", () => {
    expect(acceptanceRate(accepted, accepted + declined)).toBe(16);
  });

  it("is the share of the ring, so a segment at half the total reads 50%", () => {
    expect(acceptanceRate(100, 200)).toBe(50);
  });

  it("says nothing rather than dividing by nothing in an empty period", () => {
    expect(acceptanceRate(0, 0)).toBe(0);
  });
});
