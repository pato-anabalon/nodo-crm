"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Briefcase, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { QuoteDeclineReason, QuoteStatus } from "@/generated/prisma/enums";
import { acceptedKey, celebrate, originOf } from "@/lib/celebrate";
import type { QuoteActionState } from "./actions";

/**
 * Status-change buttons. Valid transitions are decided by the server; here we
 * only show the ones that make sense for the current status.
 */
export function QuoteActionsBar({
  quoteId,
  status,
  canSend,
  canDecide,
  hasLead,
  onSend,
  onDecide,
  previewHref,
  job,
  onStartJob,
}: {
  quoteId: string;
  status: QuoteStatus;
  canSend: boolean;
  canDecide: boolean;
  /** Whether a lead is linked — a quote with none has nowhere to log its
   * history, so Send stays disabled rather than bouncing back with an error
   * once clicked. */
  hasLead: boolean;
  onSend: () => Promise<QuoteActionState>;
  /** Declining carries the dialog's form: why, and a note. */
  onDecide: (decision: "ACCEPTED" | "REJECTED", formData?: FormData) => Promise<QuoteActionState>;
  /**
   * The quote's own `/preview` route, shown beside Send so it can be checked
   * right before it goes out. Only offered alongside Send — once the quote is
   * out for a decision, the share card below has its own preview link.
   */
  previewHref?: string;
  /** The job this quote became, once it has one. */
  job?: { href: string } | null;
  /**
   * Turns the accepted quote into a job. Only passed when the profile holds
   * `jobs.create`; the action redirects to the new job on success.
   */
  onStartJob?: () => Promise<QuoteActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const t = useTranslations("quotes");
  const tCommon = useTranslations("common");

  function run(
    label: string,
    fn: () => Promise<QuoteActionState>,
    onDone?: () => void,
  ) {
    setBusy(label);
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else {
        if (result.message) toast.success(result.message);
        onDone?.();
      }
      setBusy(null);
    });
  }

  const showSend = canSend && status === QuoteStatus.DRAFT;
  const showDecision = canDecide && status === QuoteStatus.SENT;
  const accepted = status === QuoteStatus.ACCEPTED;
  const showOpenJob = accepted && Boolean(job);
  const showStartJob = accepted && !job && Boolean(onStartJob);

  if (!showSend && !showDecision && !showOpenJob && !showStartJob) return null;

  return (
    // On a phone the bar spans the width and its two buttons take half each (one
    // alone takes it all); from 640px it goes back to buttons the size of their
    // text, wrapping if it must.
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap [&>*:only-child]:col-span-2">
      {showSend ? (
        <>
          {previewHref ? (
            <Button asChild variant="outline">
              <Link href={previewHref}>
                <ExternalLink className="size-4" />
                {t("form.preview")}
              </Link>
            </Button>
          ) : null}

          <Button
            onClick={(event) => {
              // Read now, while the button is still under the pointer: by the
              // time the action resolves the bar may have re-rendered away.
              const origin = originOf(event.currentTarget);
              // Small and short: sending is routine, and this happens several
              // times a week. No key — it answers a click, so it fires every time.
              run("send", onSend, () => void celebrate({ intensity: "small", origin }));
            }}
            disabled={pending || !hasLead}
            title={hasLead ? undefined : t("needsLeadToSend")}
          >
            {busy === "send" ? t("actions.sending") : t("actions.send")}
          </Button>
        </>
      ) : null}

      {showDecision ? (
        <>
          <Button
            variant="default"
            onClick={() =>
              // Recording by hand what the customer said on the phone is the
              // same news as them clicking accept. The key is the one the page
              // uses, so revalidating into ACCEPTED can't celebrate it twice.
              run("accept", () => onDecide("ACCEPTED"), () =>
                void celebrate({ key: acceptedKey.staff(quoteId) }),
              )
            }
            disabled={pending}
          >
            {busy === "accept" ? tCommon("saving") : t("actions.accept")}
          </Button>
          <Button variant="outline" onClick={() => setDeclining(true)} disabled={pending}>
            {t("actions.reject")}
          </Button>
          <DeclineDialog
            open={declining}
            onOpenChange={setDeclining}
            onDecline={(formData) => onDecide("REJECTED", formData)}
          />
        </>
      ) : null}

      {showOpenJob && job ? (
        <Button asChild variant="outline">
          <Link href={job.href}>
            <Briefcase className="size-4" />
            {t("actions.openJob")}
          </Link>
        </Button>
      ) : null}

      {showStartJob && onStartJob ? (
        <Button onClick={() => run("startJob", onStartJob)} disabled={pending}>
          <Briefcase className="size-4" />
          {busy === "startJob" ? t("actions.startingJob") : t("actions.startJob")}
        </Button>
      ) : null}
    </div>
  );
}

const DECLINE_REASONS = Object.values(QuoteDeclineReason);

/**
 * Declining from the company's side asks why, because it isn't always the
 * customer's answer — a quote replaced by another, or sent by mistake, is the
 * company's own reason — and the history should say which, beside who.
 */
function DeclineDialog({
  open,
  onOpenChange,
  onDecline,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecline: (formData: FormData) => Promise<QuoteActionState>;
}) {
  const t = useTranslations("quotes");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await onDecline(formData);
      if (result.fieldErrors) return setErrors(result.fieldErrors);
      if (result.error) return void toast.error(result.error);
      if (result.message) toast.success(result.message);
      setErrors({});
      setReason("");
      onOpenChange(false);
    });
  }

  const other = reason === QuoteDeclineReason.OTHER;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("decline.title")}</DialogTitle>
          <DialogDescription>{t("decline.body")}</DialogDescription>
        </DialogHeader>

        <form action={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="decline-reason">{t("decline.reason")}</Label>
            <NativeSelect
              id="decline-reason"
              name="reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("decline.choose")}
              options={DECLINE_REASONS.map((value) => ({ value, label: t(`declineReasons.${value}`) }))}
              aria-invalid={errors.reason ? true : undefined}
            />
            {errors.reason ? <p className="text-sm text-destructive">{errors.reason[0]}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="decline-note">{other ? t("decline.noteForOther") : t("decline.note")}</Label>
            <Textarea
              id="decline-note"
              name="note"
              rows={3}
              maxLength={500}
              required={other}
              placeholder={t("decline.notePlaceholder")}
              aria-invalid={errors.note ? true : undefined}
            />
            {errors.note ? <p className="text-sm text-destructive">{errors.note[0]}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? tCommon("saving") : t("decline.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
