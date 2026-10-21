"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateCompanyAction, convertToCustomerAction, setDemoDaysAction, type PlatformState } from "./actions";
import { DATE } from "./dates";
import type { CompanyRow } from "./service";
import { DEMO_DAYS_DEFAULT, DEMO_DAYS_MAX, demoEndsAt, isValidDemoDays } from "./status";

/** Reads the days typed in: anything that isn't a whole number reads as invalid, never as 0. */
function parseDays(text: string): number | null {
  const days = Number(text);
  return text.trim() !== "" && isValidDemoDays(days) ? days : null;
}

/**
 * Switching a company on is the moment the admin decides what kind of access it
 * gets, so it is a question rather than a button: plain access, or a demo of so
 * many days. The checkbox starts as the company last was — a demo that ran out
 * offers its own days back — which makes "extend" a single press.
 */
export function ActivateDialog({ company, host, trigger }: { company: CompanyRow; host: string; trigger: ReactNode }) {
  const t = useTranslations("platform");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [demo, setDemo] = useState(company.isDemo);
  const [daysText, setDaysText] = useState(String(company.demoDays ?? DEMO_DAYS_DEFAULT));

  const days = parseDays(daysText);
  const ready = !demo || days !== null;

  function submit() {
    startTransition(async () => {
      const result = await activateCompanyAction(company.id, { demo, days: demo ? (days ?? undefined) : undefined });
      announce(result);
      if (!result.error) setOpen(false);
    });
  }

  const ended = company.status.kind === "demoEnded" ? company.status.endedAt : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("activateDialog.title", { company: company.name })}</DialogTitle>
          <DialogDescription>
            {t("activateDialog.body", { host })}
            {ended ? ` ${t("activateDialog.endedNote", { date: DATE.format(ended) })}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox id={`${company.id}-demo`} checked={demo} onCheckedChange={(checked) => setDemo(checked === true)} className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor={`${company.id}-demo`}>{t("activateDialog.demoLabel")}</Label>
              <p className="text-xs text-muted-foreground">{t("activateDialog.demoHint")}</p>
            </div>
          </div>

          {demo ? (
            <div className="space-y-2">
              <Label htmlFor={`${company.id}-days`}>{t("activateDialog.daysLabel")}</Label>
              <Input
                id={`${company.id}-days`}
                type="number"
                inputMode="numeric"
                min={1}
                max={DEMO_DAYS_MAX}
                step={1}
                value={daysText}
                onChange={(event) => setDaysText(event.target.value)}
                aria-invalid={days === null}
                className="w-32"
              />
              {days !== null ? (
                <p className="text-xs text-muted-foreground">
                  {t("activateDialog.endsOn", { date: DATE.format(demoEndsAt(new Date(), days)) })}
                </p>
              ) : (
                <p className="text-xs text-destructive">{t("errors.demoDays")}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("activateDialog.noEnd")}</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{tCommon("cancel")}</Button>
          </DialogClose>
          <Button onClick={submit} disabled={pending || !ready}>
            {t("activateDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What can be done to a demo that is running: change how long it lasts, or end
 * it by making the company a customer. Neither suspends anything.
 */
export function DemoDialog({ company, trigger }: { company: CompanyRow; trigger: ReactNode }) {
  const t = useTranslations("platform");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [daysText, setDaysText] = useState(String(company.demoDays ?? DEMO_DAYS_DEFAULT));

  const days = parseDays(daysText);
  const startedAt = company.demoStartedAt;

  function run(action: () => Promise<PlatformState>) {
    startTransition(async () => {
      const result = await action();
      announce(result);
      if (!result.error) setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("demoDialog.title", { company: company.name })}</DialogTitle>
          <DialogDescription>
            {startedAt ? t("demoDialog.started", { date: DATE.format(startedAt) }) : null}
            {company.demoEndsAt ? ` · ${t("demoDialog.ends", { date: DATE.format(company.demoEndsAt) })}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`${company.id}-demo-days`}>{t("demoDialog.daysLabel")}</Label>
          <Input
            id={`${company.id}-demo-days`}
            type="number"
            inputMode="numeric"
            min={1}
            max={DEMO_DAYS_MAX}
            step={1}
            value={daysText}
            onChange={(event) => setDaysText(event.target.value)}
            aria-invalid={days === null}
            className="w-32"
          />
          {days !== null && startedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("demoDialog.ends", { date: DATE.format(demoEndsAt(startedAt, days)) })}
            </p>
          ) : days === null ? (
            <p className="text-xs text-destructive">{t("errors.demoDays")}</p>
          ) : null}
        </div>

        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-3 text-xs text-muted-foreground">{t("demoDialog.convertHint")}</p>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => convertToCustomerAction(company.id))}>
            {t("demoDialog.convert")}
          </Button>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{tCommon("cancel")}</Button>
          </DialogClose>
          <Button disabled={pending || days === null} onClick={() => days !== null && run(() => setDemoDaysAction(company.id, days))}>
            {t("demoDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function announce(result: PlatformState) {
  if (result.error) toast.error(result.error);
  else if (result.message) toast.success(result.message);
}
