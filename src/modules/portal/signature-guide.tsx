import { SIGNATURE_LINE } from "./signature";

/**
 * The line to sign on, and "Sign here" above it until there is ink.
 *
 * Drawn behind the canvas rather than on it, so it is never part of what gets
 * stored or sent, and it takes no pointer events: the pen goes straight
 * through to the canvas. Shared by the computer's pad and the phone's, so the
 * two boxes read as the same thing.
 */
export function SignatureGuide({ label, inked }: { label: string; inked: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
      {inked ? null : (
        <span
          className="absolute inset-x-0 text-center text-3xl font-light tracking-wide text-muted-foreground/35 sm:text-4xl"
          style={{ bottom: `calc(${(1 - SIGNATURE_LINE) * 100}% + 0.5rem)` }}
        >
          {label}
        </span>
      )}
      <span
        className="absolute inset-x-6 border-t border-dashed border-muted-foreground/30"
        style={{ top: `${SIGNATURE_LINE * 100}%` }}
      />
    </div>
  );
}
