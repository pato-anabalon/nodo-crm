import { getTranslations } from "next-intl/server";
import { BrandImageCard } from "./brand-image-card";
import { removePdfLogoAction, uploadPdfLogoAction } from "./actions";

/**
 * The logo the downloadable PDF carries, instead of the company's logo.
 *
 * The PDF lays it across half the page width, which is room for the full
 * lock-up — the company's name beside its mark — where the sidebar and the
 * portal want the compact square. Previewed wide, on white, the way the PDF
 * prints it; with none, the preview says what happens instead.
 */
export async function PdfLogoManager({
  companyName,
  pdfLogoUrl,
  canManage,
}: {
  companyName: string;
  pdfLogoUrl: string | null;
  canManage: boolean;
}) {
  const t = await getTranslations("settings.pdfLogo");

  return (
    <BrandImageCard
      kind="pdfLogo"
      preview={
        pdfLogoUrl ? (
          <div className="flex h-14 w-28 items-center justify-center rounded-md border bg-white p-1.5">
            {/* Served from the blob store, or from whatever host a company
                pointed at — so the host isn't known ahead of time. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pdfLogoUrl} alt={companyName} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-14 w-28 items-center justify-center rounded-md border border-dashed px-2 text-center text-[10px] text-muted-foreground">
            {t("none")}
          </div>
        )
      }
      hasImage={Boolean(pdfLogoUrl)}
      canManage={canManage}
      uploadAction={uploadPdfLogoAction}
      removeAction={removePdfLogoAction}
      labels={{
        title: t("title"),
        subtitle: t("subtitle"),
        upload: t("upload"),
        choose: t("choose"),
        noneChosen: t("noneChosen"),
        save: t("save"),
        uploading: t("uploading"),
        hint: t("hint"),
        remove: t("remove"),
        removeTitle: t("removeTitle"),
        removeConfirm: t("removeConfirm"),
      }}
    />
  );
}
