import type { EnquiriesCopy } from "../copy";
import { Phone } from "../phone";
import { Reveal } from "../reveal";
import { SCREENS } from "../sample";

const LEFT = ["form", "person"] as const;
const RIGHT = ["tasks", "pipeline"] as const;

/**
 * A phone held in the middle while the features around it rise in as the
 * page scrolls past — EventBeds' second section, with Nodo's enquiries.
 */
export function Enquiries({ copy }: { copy: EnquiriesCopy }) {
  const feature = (key: keyof EnquiriesCopy["features"], delay: number) => (
    <Reveal key={key} delay={delay} className="max-w-xs">
      <h3 className="text-lg font-semibold tracking-tight text-zinc-900">{copy.features[key].title}</h3>
      <p className="mt-2 text-zinc-600">{copy.features[key].body}</p>
    </Reveal>
  );

  return (
    // Above Quotes, which is pulled up underneath it on a wide screen and uncovered as this scrolls away.
    <section id="enquiries" className="relative z-10 bg-white px-5 py-24 md:px-8 md:py-36">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-[#1a4be0]">{copy.kicker}</p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.03em] text-zinc-950 md:text-6xl">{copy.title}</h2>
          <p className="mt-5 text-pretty text-lg text-zinc-600">{copy.body}</p>
        </Reveal>

        <div className="mt-16 grid items-start gap-12 md:mt-24 md:grid-cols-[1fr_auto_1fr] md:gap-16">
          <div className="order-2 grid gap-12 md:order-1 md:gap-56 md:pt-24 md:text-right md:[&>*]:ml-auto">
            {LEFT.map((key, index) => feature(key, index * 0.1))}
          </div>
          <div className="order-1 flex justify-center md:sticky md:top-24 md:order-2">
            <Phone src={SCREENS.leads} alt={copy.phoneAlt} className="w-[240px] md:w-[280px]" sizes="280px" />
          </div>
          <div className="order-3 grid gap-12 md:gap-56 md:pt-56">{RIGHT.map((key, index) => feature(key, index * 0.1))}</div>
        </div>
      </div>
    </section>
  );
}
