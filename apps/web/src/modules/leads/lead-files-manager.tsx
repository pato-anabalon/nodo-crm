"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileImage, FileText, File as FileIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { FilePicker } from "@/components/file-picker";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/modules/documents/constants";
import type { LeadFileInfo, LeadFileState, LeadFileTicket } from "./file-actions";

export type LeadFileRow = { id: string; name: string; url: string; size: number; contentType: string };

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/** Above this the file goes up in parts that retry by themselves. */
const MULTIPART_FROM_BYTES = 5 * 1024 * 1024;

export type LeadFileActions = {
  prepare: (leadId: string, file: LeadFileInfo) => Promise<LeadFileTicket>;
  register: (leadId: string, upload: { pathname: string; name: string }) => Promise<LeadFileState>;
  remove: (leadId: string, fileId: string) => Promise<LeadFileState>;
};

function iconFor(contentType: string) {
  if (contentType === "application/pdf") return FileText;
  if (contentType.startsWith("image/")) return FileImage;
  return FileIcon;
}

/**
 * The files the team attached to a lead by hand — what the customer sent over
 * the phone or by email. Ask, send, record: the file goes from the browser
 * straight to the store, and the server only ever sees its name, size and type
 * and then where it landed. The actions come in as props, not imports, like
 * every server action used by a client component here.
 */
export function LeadFilesManager({
  leadId,
  files,
  canManage,
  formatLocale,
  actions,
}: {
  leadId: string;
  files: LeadFileRow[];
  canManage: boolean;
  formatLocale: string;
  actions: LeadFileActions;
}) {
  const t = useTranslations("leads.files");
  const [items, setItems] = useState(files);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function send(file: File) {
    setUploading(true);
    try {
      const ticket = await actions.prepare(leadId, { name: file.name, size: file.size, type: file.type });
      if (ticket.error || !ticket.pathname || !ticket.token) {
        toast.error(ticket.error ?? t("errors.failed"));
        return;
      }

      let stored: { pathname: string };
      try {
        const { put } = await import("@vercel/blob/client");
        stored = await put(ticket.pathname, file, {
          access: "public",
          token: ticket.token,
          contentType: file.type,
          multipart: file.size > MULTIPART_FROM_BYTES,
        });
      } catch {
        toast.error(t("errors.failed"));
        return;
      }

      const result = await actions.register(leadId, { pathname: stored.pathname, name: file.name });
      if (result.error) toast.error(result.error);
      else {
        if (result.message) toast.success(result.message);
        if (result.file) setItems((current) => [...current, result.file!]);
      }
    } finally {
      setUploading(false);
    }
  }

  function remove(file: LeadFileRow) {
    startTransition(async () => {
      const result = await actions.remove(leadId, file.id);
      if (result.error) toast.error(result.error);
      else setItems((current) => current.filter((item) => item.id !== file.id));
    });
  }

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((file) => {
              const Icon = iconFor(file.contentType);
              const isImage = file.contentType.startsWith("image/");
              return (
                <li key={file.id} className="relative min-w-0">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col overflow-hidden rounded-lg border bg-background hover:bg-accent"
                  >
                    {isImage ? (
                      // A thumbnail straight from our own store; next/image would
                      // need every Blob host configured for no gain here.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.name}
                        loading="lazy"
                        className="aspect-video w-full bg-muted object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center bg-muted">
                        <Icon className="size-8 text-muted-foreground" />
                      </div>
                    )}

                    <div className="min-w-0 p-3 pr-12">
                      <p className="truncate text-sm font-medium" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size, formatLocale)}
                      </p>
                    </div>
                  </a>

                  {canManage ? (
                    // Beside the link, not inside it: a button in an anchor is
                    // invalid HTML and would open the file as well.
                    <div className="absolute right-2 bottom-2">
                      <ConfirmButton
                        disabled={pending}
                        title={t("deleteTitle")}
                        description={t("deleteConfirm", { name: file.name })}
                        confirmLabel={t("delete")}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`${t("delete")} ${file.name}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        onConfirm={() => remove(file)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {canManage ? (
          <form
            action={async (formData) => {
              const file = formData.get("file");
              if (!(file instanceof File) || file.size === 0) {
                toast.error(t("errors.empty"));
                return;
              }
              await send(file);
            }}
            className="space-y-2"
          >
            <Label htmlFor="leadFile">{t("upload")}</Label>
            <FilePicker
              id="leadFile"
              name="file"
              accept={ACCEPT}
              chooseLabel={t("choose")}
              noneChosenLabel={t("noneChosen")}
              submitLabel={t("submit")}
              pendingLabel={t("uploading")}
              pending={uploading}
            />
            <p className="text-xs text-muted-foreground">{t("hint")}</p>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
