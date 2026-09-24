import { getTranslations } from "next-intl/server";
import type { Funnel } from "./service";

/**
 * Leads received, quoted and won.
 *
 * One series, one colour: the three bars are the same population at three
 * moments, not three categories, so giving them different hues would invent an
 * identity they don't have. What carries the meaning is the width, and the
 * conversion rate spelled out between the steps.
 */
export async function FunnelChart({ funnel }: { funnel: Funnel }) {
  const t = await getTranslations("reports.funnel");

  const steps = [
    { key: "received", value: funnel.received, rate: null as number | null },
    { key: "quoted", value: funnel.quoted, rate: funnel.quotedRate },
    { key: "won", value: funnel.won, rate: funnel.wonRate },
  ];

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={step.key} className="space-y-1.5">
          {step.rate !== null ? (
            <p className="pl-1 text-xs text-muted-foreground">
              {t(`rate.${step.key}`, { rate: step.rate })}
            </p>
          ) : null}

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm">{t(`steps.${step.key}`)}</span>
            <span className="text-sm font-semibold tabular-nums">{step.value}</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${widthFor(step.value, funnel.received)}%` }}
              // The exact figure is written above; the bar only carries the shape.
              aria-hidden
            />
          </div>

          {index === steps.length - 1 && funnel.received === 0 ? (
            <p className="text-xs text-muted-foreground">{t("empty")}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Width as a share of the first step.
 *
 * A non-zero step never renders as nothing: one lead out of five hundred would
 * otherwise disappear and read as zero. The exact number sits next to the bar,
 * so the floor costs no accuracy.
 */
function widthFor(value: number, total: number): number {
  if (total <= 0 || value <= 0) return 0;
  return Math.max(1.5, (value / total) * 100);
}
