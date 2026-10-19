"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AcceptanceMode } from "@/generated/prisma/enums";
import { SignaturePad, type HandoffStarter } from "./signature-pad";
import type { PortalActionState } from "./actions";

export type AcceptanceSettings = {
  mode: AcceptanceMode;
  statement: string | null;
  requireSignature: boolean;
  askAdditionalComments: boolean;
  askOrderReference: boolean;
};

/**
 * What the customer fills in to accept.
 *
 * The shape is decided by each company: simple statement or with a checkbox, an
 * optional signature and the two extra fields. This only reflects that setup.
 */
export function AcceptPanel({
  settings,
  viewerName,
  acceptAction,
  declineAction,
  signatureHandoff,
}: {
  settings: AcceptanceSettings;
  /**
   * Who is accepting, from the link they opened — never typed. Each recipient
   * is sent their own link, so the statement names the person holding it, and
   * the server signs the acceptance with the same name whatever is posted.
   */
  viewerName: string;
  acceptAction: (prev: PortalActionState, formData: FormData) => Promise<PortalActionState>;
  declineAction: (prev: PortalActionState, formData: FormData) => Promise<PortalActionState>;
  /** "Sign from a touch device": opens the QR, and where to ask for strokes. */
  signatureHandoff?: { start: HandoffStarter; pollBase: string };
}) {
  const t = useTranslations("portal");
  const [accept, acceptFormAction, accepting] = useActionState<PortalActionState, FormData>(
    acceptAction,
    {},
  );
  const [decline, declineFormAction, declining] = useActionState<PortalActionState, FormData>(
    declineAction,
    {},
  );
  const [showDecline, setShowDecline] = useState(false);

  const needsCheckbox = settings.mode === AcceptanceMode.STATEMENT_WITH_CHECKBOX;
  // The customer sees exactly what they're accepting, in their own name.
  const displayName = viewerName.trim() || "…";
  const statementBody = settings.statement?.trim() || t("defaultStatement");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("acceptTitle")}</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={acceptFormAction} className="space-y-5">
            {accept.error ? (
              <Alert variant="destructive">
                <AlertDescription>{accept.error}</AlertDescription>
              </Alert>
            ) : null}

            {settings.requireSignature ? <SignaturePad required handoff={signatureHandoff} /> : null}
            {accept.fieldErrors?.signatureData ? (
              <p className="text-sm text-destructive">{accept.fieldErrors.signatureData[0]}</p>
            ) : null}

            {settings.askAdditionalComments ? (
              <div className="space-y-2">
                <Label htmlFor="additionalComments">{t("additionalComments")}</Label>
                <Textarea id="additionalComments" name="additionalComments" rows={3} />
              </div>
            ) : null}

            {settings.askOrderReference ? (
              <div className="space-y-2">
                <Label htmlFor="orderReference">{t("orderReference")}</Label>
                <Input id="orderReference" name="orderReference" />
              </div>
            ) : null}

            {needsCheckbox ? (
              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  <Checkbox name="agree" className="mt-0.5" />
                  <span>
                    {t("statementCheckbox", { name: displayName }).replace(
                      t("defaultStatement"),
                      statementBody,
                    )}
                  </span>
                </label>
                {accept.fieldErrors?.agree ? (
                  <p className="text-sm text-destructive">{accept.fieldErrors.agree[0]}</p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                {t("statementSimple", { name: displayName }).replace(
                  t("defaultStatement"),
                  statementBody,
                )}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="lg" disabled={accepting}>
                {accepting ? t("accepting") : t("accept")}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="ghost"
                onClick={() => setShowDecline((value) => !value)}
              >
                {t("decline")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {showDecline ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("declineTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={declineFormAction} className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("declineBody")}</p>
              <div className="space-y-2">
                <Label htmlFor="reason">{t("declineReason")}</Label>
                <Textarea id="reason" name="reason" rows={3} />
              </div>
              {decline.error ? (
                <p className="text-sm text-destructive">{decline.error}</p>
              ) : null}
              <Button type="submit" variant="destructive" disabled={declining}>
                {declining ? t("declining") : t("decline")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
