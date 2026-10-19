import Image from "next/image";
import { cn } from "@/lib/utils";
import { SCREEN_SIZE } from "./sample";

/** Where the side buttons sit, as a share of the phone's height — an iPhone Pro's layout. */
const BUTTONS = [
  { side: "left", top: 17, height: 3.6 }, // action
  { side: "left", top: 25.5, height: 6.5 }, // volume up
  { side: "left", top: 34, height: 6.5 }, // volume down
  { side: "right", top: 27, height: 10.5 }, // side
  { side: "right", top: 55, height: 7 }, // camera control
] as const;

/**
 * A phone drawn in CSS around a screenshot: a titanium band, the black border
 * inside it, the side buttons, the Dynamic Island and a sheen across the
 * glass. Every measure is in `cqw` — a share of the phone's own width — so it
 * keeps an iPhone's proportions at whatever size a section sets it.
 *
 * Drawn rather than a photograph of one: Apple's device images are licensed
 * for App Store apps, and a picture frame is fixed to one size and one angle.
 *
 * The screenshots are placeholders in `public/landing/screens/` (see
 * `sample.ts` for where each comes from); replacing a file with a real capture
 * of the same name and proportion is all it takes.
 */
export function Phone({
  src,
  alt,
  className,
  priority = false,
  sizes = "320px",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={cn("@container relative aspect-[1179/2556]", className)}>
      {BUTTONS.map(({ side, top, height }) => (
        <span
          key={`${side}-${top}`}
          aria-hidden
          className={cn(
            "absolute w-[1.4cqw] bg-gradient-to-r from-[#4a4a4f] via-[#a3a3a8] to-[#4a4a4f]",
            side === "left" ? "-left-[0.9cqw] rounded-l-[0.6cqw]" : "-right-[0.9cqw] rounded-r-[0.6cqw]",
          )}
          style={{ top: `${top}%`, height: `${height}%` }}
        />
      ))}

      {/* The titanium band: lit along its edges, darker across its faces. */}
      <div className="absolute inset-0 rounded-[17cqw] bg-gradient-to-br from-[#a3a3a8] via-[#55555a] to-[#8e8e93] p-[1.1cqw] shadow-[0_40px_80px_-20px_rgba(10,20,40,0.5),inset_0_0_0_1px_rgba(255,255,255,0.28)]">
        <div className="h-full w-full rounded-[16cqw] bg-black p-[2.4cqw] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="relative h-full w-full overflow-hidden rounded-[13.6cqw] bg-white">
            <Image
              src={src}
              alt={alt}
              width={SCREEN_SIZE.width}
              height={SCREEN_SIZE.height}
              sizes={sizes}
              priority={priority}
              className="h-full w-full object-cover object-top"
            />
            {/* Glass: a faint diagonal catch of light, never enough to dim the capture. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.04)_28%,transparent_42%)]"
            />
          </div>
        </div>
      </div>

      <span
        aria-hidden
        className="absolute left-1/2 top-[6.2cqw] flex h-[9cqw] w-[31cqw] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-[2.6cqw]"
      >
        {/* The front camera's lens, just visible in the island. */}
        <span className="size-[3.2cqw] rounded-full bg-[radial-gradient(circle_at_35%_35%,#3b4a6b,#0b0d14_70%)]" />
      </span>
    </div>
  );
}
