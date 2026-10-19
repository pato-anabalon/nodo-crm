"use client";

import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import type { Option } from "@/lib/intl/options";

/**
 * The Lineup's filters: a plain GET form, so a filtered view is a link that
 * can be shared or bookmarked. Each select submits as soon as it changes.
 */
export function LineupFilters({
  from,
  status,
  memberId,
  tradeId,
  people,
  trades,
}: {
  from: string | null;
  status: "active" | "all";
  memberId: string | null;
  tradeId: string | null;
  people: Option[];
  trades: Option[];
}) {
  const t = useTranslations("lineup");
  const submit = (event: React.ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();
  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      {from ? <input type="hidden" name="from" value={from} /> : null}
      <NativeSelect
        name="status"
        aria-label={t("filters.status")}
        defaultValue={status}
        onChange={submit}
        className="h-9 w-auto"
        options={[
          { value: "active", label: t("filters.active") },
          { value: "all", label: t("filters.all") },
        ]}
      />
      <NativeSelect
        name="member"
        aria-label={t("filters.member")}
        defaultValue={memberId ?? ""}
        onChange={submit}
        className="h-9 w-auto max-w-48"
        options={[{ value: "", label: t("filters.anyone") }, ...people]}
      />
      {trades.length > 0 ? (
        <NativeSelect
          name="trade"
          aria-label={t("filters.trade")}
          defaultValue={tradeId ?? ""}
          onChange={submit}
          className="h-9 w-auto max-w-48"
          options={[{ value: "", label: t("filters.anyTrade") }, ...trades]}
        />
      ) : null}
    </form>
  );
}
