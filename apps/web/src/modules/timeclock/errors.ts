/**
 * A punch the clock won't take, with a code the app translates and whatever
 * helps it say why (how far away, the shift already open). `conflict` is a
 * clash with what is already recorded — answered 409 — rather than a punch
 * that is wrong in itself, answered 422.
 */
export class TimeclockRefusal extends Error {
  constructor(
    public readonly code: string,
    public readonly conflict: boolean,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "TimeclockRefusal";
  }
}
