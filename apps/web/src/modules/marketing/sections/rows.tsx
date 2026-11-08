import type { RowsCopy } from "../copy";
import { BrandDemo } from "../demos/brand-demo";
import { LiveDemo } from "../demos/live-demo";
import { NumbersDemo } from "../demos/numbers-demo";
import { Reveal } from "../reveal";

/**
 * Three rows, each showing its feature rather than describing it: a quote that
 * takes the visitor's own name and colour, one quote's week drawn as the
 * scroll goes by, and a reports panel that assembles itself.
 *
 * It opens on the night the Jobs section ends in, and the white rises over it
 * as a sheet, so leaving the house in the dark is a turn of the page rather
 * than a cut.
 */
export function Rows({ copy }: { copy: RowsCopy }) {
  return (
    <section className="bg-[#0a1433]">
      <Reveal
        as="h2"
        className="mx-auto max-w-3xl text-balance px-5 pb-16 pt-24 text-center text-4xl font-semibold tracking-[-0.03em] text-white md:px-8 md:pb-24 md:pt-32 md:text-6xl"
      >
        {copy.title}
      </Reveal>
      <div className="rounded-t-[2.5rem] bg-white px-5 py-24 md:rounded-t-[4rem] md:px-8 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-28 md:gap-40">
          <BrandDemo copy={copy.brand} />
          <LiveDemo copy={copy.live} flip />
          <NumbersDemo copy={copy.numbers} />
        </div>
      </div>
    </section>
  );
}
