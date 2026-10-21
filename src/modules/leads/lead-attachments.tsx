import { getTranslations } from "next-intl/server";
import { File as FileIcon, FileText, Loader2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/modules/documents/constants";

type Attachment = {
  id: string;
  name: string;
  contentType: string | null;
  size: number | null;
  sourceUrl: string;
  url: string | null;
  status: "PENDING" | "STORED" | "FAILED";
};

/**
 * The files the customer sent with the form.
 *
 * Photos show as thumbnails because that's usually what they are: the wall, the
 * ceiling, the damage. A file still being copied, or whose copy failed, links to
 * where the form left it, so it can always be opened.
 */
export async function LeadAttachmentsPanel({
  attachments,
  formatLocale,
}: {
  attachments: Attachment[];
  formatLocale: string;
}) {
  if (attachments.length === 0) return null;
  const t = await getTranslations("leads.attachments");

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("title", { count: attachments.length })}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attachments.map((attachment) => {
            const href = attachment.url ?? attachment.sourceUrl;
            const isImage =
              attachment.status === "STORED" && attachment.contentType?.startsWith("image/");
            const Icon = attachment.contentType === "application/pdf" ? FileText : FileIcon;

            return (
              <li key={attachment.id} className="min-w-0">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full flex-col overflow-hidden rounded-lg border bg-background hover:bg-accent"
                >
                  {isImage ? (
                    // A remote thumbnail from our own store; next/image would
                    // need every Blob host configured for no gain here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={href}
                      alt={attachment.name}
                      loading="lazy"
                      className="aspect-video w-full bg-muted object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-muted">
                      <Icon className="size-8 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{attachment.name}</p>
                      {attachment.size !== null ? (
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(attachment.size, formatLocale)}
                        </p>
                      ) : null}
                    </div>

                    {attachment.status === "PENDING" ? (
                      <Badge variant="outline" className="shrink-0 gap-1">
                        <Loader2 className="size-3 animate-spin" />
                        {t("pending")}
                      </Badge>
                    ) : attachment.status === "FAILED" ? (
                      <Badge variant="outline" className="shrink-0 gap-1" title={t("failedHint")}>
                        <TriangleAlert className="size-3" />
                        {t("failed")}
                      </Badge>
                    ) : null}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
