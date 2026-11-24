"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Briefcase, ExternalLink, Paperclip, X } from "lucide-react";
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
import { QuoteAcceptReason, QuoteDeclineReason, QuoteStatus } from "@/generated/prisma/enums";
import { acceptedKey, celebrate, originOf } from "@/lib/celebrate";
import { formatBytes } from "@/modules/documents/constants";
import type { AttachmentFileInfo, AttachmentUploadTicket, QuoteActionState } from "./actions";
import { ACCEPTED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, MAX_EVIDENCE_FILES, checkEvidence } from "./attachments";

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
  prepareEvidence,
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
  /** Both carry the dialog's form: why, a note and, accepting, the evidence. */
  onDecide: (decision: "ACCEPTED" | "REJECTED", formData?: FormData) => Promise<QuoteActionState>;
  /** A token to upload one piece of the customer's word, before accepting. */
  prepareEvidence: (file: AttachmentFileInfo) => Promise<AttachmentUploadTicket>;
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
  const [accepting, setAccepting] = useState(false);
  const t = useTranslations("quotes");

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
          <Button variant="default" onClick={() => setAccepting(true)} disabled={pending}>
            {t("actions.accept")}
          </Button>
          <AcceptDialog
            open={accepting}
            onOpenChange={setAccepting}
            prepareEvidence={prepareEvidence}
            // Recording what the customer said elsewhere is the same news as them
            // clicking accept. The key is the one the page uses, so revalidating
            // into ACCEPTED can't celebrate it twice.
            onAccept={(formData) => onDecide("ACCEPTED", formData)}
            onAccepted={() => void celebrate({ key: acceptedKey.staff(quoteId) })}
          />
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

const ACCEPT_REASONS = Object.values(QuoteAcceptReason);

/** Above this, a file goes up in parts that retry on their own, as an attachment does. */
const MULTIPART_FROM_BYTES = 5 * 1024 * 1024;

/**
 * Accepting on the customer's behalf asks how they said yes and for their
 * word itself — the email, the WhatsApp, the signed copy — because nothing
 * else backs it: the portal's acceptance has a signature and a fingerprint,
 * a button pressed in the office has neither. The files go straight to the
 * store before the form is sent, and the server checks them there.
 */
function AcceptDialog({
  open,
  onOpenChange,
  prepareEvidence,
  onAccept,
  onAccepted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prepareEvidence: (file: AttachmentFileInfo) => Promise<AttachmentUploadTicket>;
  onAccept: (formData: FormData) => Promise<QuoteActionState>;
  onAccepted: () => void;
}) {
  const t = useTranslations("quotes");
  const tFiles = useTranslations("quotes.attachments");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const input = useRef<HTMLInputElement>(null);
  const locale = useLocale();

  function refusal(file: File, index: number): string | null {
    const check = checkEvidence({ name: file.name, size: file.size, type: file.type }, index);
    if (check.ok) return null;
    if (check.reason === "type") return tFiles("errors.type");
    if (check.reason === "size") return tFiles("errors.size", { max: MAX_ATTACHMENT_BYTES / (1024 * 1024) });
    if (check.reason === "too-many") return tFiles("errors.tooMany", { max: MAX_EVIDENCE_FILES });
    return tFiles("errors.empty");
  }

  function choose(chosen: FileList | null) {
    const next = [...files, ...Array.from(chosen ?? [])];
    const problem = next.map(refusal).find(Boolean);
    if (problem) setErrors((current) => ({ ...current, evidence: [problem] }));
    else
      setErrors((current) => {
        const { evidence, ...rest } = current;
        return evidence ? rest : current;
      });
    setFiles(next.filter((file, index) => !refusal(file, index)));
    if (input.current) input.current.value = "";
  }

  async function upload(file: File): Promise<{ pathname: string; name: string } | null> {
    const ticket = await prepareEvidence({ name: file.name, size: file.size, type: file.type });
    if (ticket.error || !ticket.pathname || !ticket.token) return null;
    try {
      const { put } = await import("@vercel/blob/client");
      const stored = await put(ticket.pathname, file, {
        access: "public",
        token: ticket.token,
        contentType: file.type,
        multipart: file.size > MULTIPART_FROM_BYTES,
      });
      return { pathname: stored.pathname, name: file.name };
    } catch {
      return null;
    }
  }

  function submit(formData: FormData) {
    if (files.length === 0) return setErrors((current) => ({ ...current, evidence: [t("accept.evidenceRequired")] }));
    startTransition(async () => {
      const uploaded = await Promise.all(files.map(upload));
      if (uploaded.some((file) => !file)) return setErrors((current) => ({ ...current, evidence: [tFiles("errors.failed")] }));
      formData.set("evidence", JSON.stringify(uploaded));
      const result = await onAccept(formData);
      if (result.fieldErrors) return setErrors(result.fieldErrors);
      if (result.error) return void toast.error(result.error);
      if (result.message) toast.success(result.message);
      setErrors({});
      setReason("");
      setFiles([]);
      onOpenChange(false);
      onAccepted();
    });
  }

  const other = reason === QuoteAcceptReason.OTHER;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("accept.title")}</DialogTitle>
          <DialogDescription>{t("accept.body")}</DialogDescription>
        </DialogHeader>

        <form action={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accept-reason">{t("accept.reason")}</Label>
            <NativeSelect
              id="accept-reason"
              name="reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("accept.choose")}
              options={ACCEPT_REASONS.map((value) => ({ value, label: t(`acceptReasons.${value}`) }))}
              aria-invalid={errors.reason ? true : undefined}
            />
            {errors.reason ? <p className="text-sm text-destructive">{errors.reason[0]}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accept-evidence">{t("accept.evidence")}</Label>
            <p id="accept-evidence-hint" className="text-xs text-muted-foreground">
              {t("accept.evidenceHint", { max: MAX_EVIDENCE_FILES })}
            </p>
            {/* Positioned, so the hidden input has something to hang off. */}
            <div className="relative space-y-2">
              <input
                ref={input}
                id="accept-evidence"
                type="file"
                multiple
                accept={ACCEPTED_ATTACHMENT_TYPES.join(",")}
                className="sr-only"
                aria-describedby="accept-evidence-hint"
                onChange={(event) => choose(event.target.files)}
              />
              {files.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border px-2 py-1">
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(file.size, locale)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={pending}
                        onClick={() => setFiles(files.filter((_, position) => position !== index))}
                      >
                        <X className="size-4" />
                        <span className="sr-only">{t("accept.remove", { name: file.name })}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {files.length < MAX_EVIDENCE_FILES ? (
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
                  <Paperclip className="size-4" />
                  {files.length === 0 ? tFiles("choose") : t("accept.addAnother")}
                </Button>
              ) : null}
            </div>
            {errors.evidence ? <p className="text-sm text-destructive">{errors.evidence[0]}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accept-note">{other ? t("accept.noteForOther") : t("accept.note")}</Label>
            <Textarea
              id="accept-note"
              name="note"
              rows={3}
              maxLength={500}
              required={other}
              placeholder={t("accept.notePlaceholder")}
              aria-invalid={errors.note ? true : undefined}
            />
            {errors.note ? <p className="text-sm text-destructive">{errors.note[0]}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? tCommon("saving") : t("accept.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
