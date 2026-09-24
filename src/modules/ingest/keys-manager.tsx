"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IngestKeyType } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";
import { createIngestKeyAction, revokeIngestKeyAction, type IngestKeyState } from "./actions";

export type KeyRow = {
  id: string;
  name: string;
  type: IngestKeyType;
  prefix: string;
  allowedOrigins: string[];
  lastUsedAt: string | null;
  revoked: boolean;
  leadCount: number;
};

export function IngestKeysManager({
  keys,
  canManage,
  endpoint,
  formatLocale,
  timezone,
}: {
  keys: KeyRow[];
  canManage: boolean;
  endpoint: string;
  formatLocale: string;
  timezone: string;
}) {
  const t = useTranslations("ingest");
  const [state, formAction, creating] = useActionState<IngestKeyState, FormData>(
    createIngestKeyAction,
    {},
  );
  const [type, setType] = useState<IngestKeyType>(IngestKeyType.PUBLIC);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  return (
    <div className="space-y-6">
      {/* El token solo existe en memoria justo después de crearlo. */}
      {state.token ? <TokenOnce token={state.token} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("howTo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("howToBody")}</p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            <code>{`POST ${endpoint}
Authorization: Bearer nodo_pk_…
Content-Type: application/json

{
  "name": "Sarah Whitmore",
  "email": "sarah@example.co.nz",
  "phone": "+64 21 555 0134",
  "service": "Interior plastering",
  "message": "Kitchen walls need replastering."
}`}</code>
          </pre>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("newKey")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" name="name" required placeholder={t("namePlaceholder")} />
                {state.fieldErrors?.name ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>{t("type")}</Label>
                <input type="hidden" name="type" value={type} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[IngestKeyType.PUBLIC, IngestKeyType.SECRET].map((option) => {
                    const selected = type === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setType(option)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <span className="block text-sm font-medium">{t(`types.${option}`)}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(`types.${option}_hint`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {type === IngestKeyType.PUBLIC ? (
                <div className="space-y-2">
                  <Label htmlFor="origins">{t("origins")}</Label>
                  <Textarea
                    id="origins"
                    name="origins"
                    rows={3}
                    placeholder={t("originsPlaceholder")}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">{t("originsHint")}</p>
                  {state.fieldErrors?.origins ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.origins[0]}</p>
                  ) : null}
                </div>
              ) : null}

              <Button type="submit" disabled={creating}>
                <Plus className="size-4" />
                {creating ? t("creating") : t("create")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{t("keys")}</h2>

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className={`flex flex-wrap items-start gap-3 rounded-lg border bg-background p-4 ${
                  key.revoked ? "opacity-60" : ""
                }`}
              >
                <KeyRound className="mt-0.5 size-5 shrink-0 text-muted-foreground" />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{key.name}</span>
                    <Badge variant={key.type === IngestKeyType.PUBLIC ? "secondary" : "outline"}>
                      {t(`types.${key.type}`)}
                    </Badge>
                    {key.revoked ? (
                      <Badge variant="destructive">{t("revoked")}</Badge>
                    ) : (
                      <Badge>{t("active")}</Badge>
                    )}
                  </div>

                  <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>

                  {key.allowedOrigins.length > 0 ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      {key.allowedOrigins.join(" · ")}
                    </p>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    {t("leadsReceived", { count: key.leadCount })}
                    {" · "}
                    {key.lastUsedAt
                      ? t("lastUsed", {
                          date: formatDateTime(new Date(key.lastUsedAt), formatLocale, timezone),
                        })
                      : t("neverUsed")}
                  </p>
                </div>

                {canManage && !key.revoked ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await revokeIngestKeyAction(key.id);
                        if (result.error) toast.error(result.error);
                      })
                    }
                  >
                    {t("revoke")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The full token, shown once after the key is created. */
function TokenOnce({ token }: { token: string }) {
  const t = useTranslations("ingest");
  const [copied, setCopied] = useState(false);

  return (
    <Alert>
      <AlertTitle>{t("tokenOnce")}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{t("tokenOnceBody")}</p>
        <div className="flex w-full flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
            {token}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(token);
              setCopied(true);
              toast.success(t("copied"));
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
