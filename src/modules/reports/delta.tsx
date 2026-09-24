import { getTranslations } from "next-intl/server";

/**
 * Change against the previous period.
 *
 * Deliberately in text ink with an arrow rather than in red and green: whether
 * a rise is good depends on the measure — more quotes waiting is not the same
 * kind of news as more accepted — and colouring it would assert something the
 * panel doesn't know. The arrow gives the direction; the reader supplies the
 * judgement.
 */
export async function Delta({
  change,
  previousLabel,
}: {
  change: number | null;
  previousLabel: string;
}) {
  const t = await getTranslations("reports");

  if (change === null) {
    return <span className="text-xs text-muted-foreground">{t("noPrevious")}</span>;
  }

  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "→";

  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden>{arrow} </span>
      <span className="tabular-nums">{t("changeValue", { change: Math.abs(change) })}</span>{" "}
      {t("versus", { period: previousLabel })}
    </span>
  );
}
