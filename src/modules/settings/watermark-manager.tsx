import { getTranslations } from "next-intl/server";
import { BrandImageCard } from "./brand-image-card";
import { removeWatermarkAction, uploadWatermarkAction } from "./actions";

/**
 * The mark stamped in the corner of the quote the customer reads.
 *
 * Previewed at the opacity it is actually shown at, on the same light ground —
 * a watermark that looks right at full strength and disappears on the page is
 * the mistake this preview exists to prevent.
 */
export async function WatermarkManager({
  companyName,
  watermarkUrl,
  canManage,
}: {
  companyName: string;
  watermarkUrl: string | null;
  canManage: boolean;
}) {
  const t = await getTranslations("settings.watermark");

  return (
    <BrandImageCard
      kind="watermark"
      preview={
        watermarkUrl ? (
          <div className="flex size-14 items-center justify-center rounded-md border bg-white">
            {/* Served from the blob store, or from whatever host a company
                pointed at — so the host isn't known ahead of time. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={watermarkUrl}
              alt={companyName}
              className="max-h-10 max-w-10 object-contain opacity-15"
            />
          </div>
        ) : (
          <div className="flex size-14 items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">
            {t("none")}
          </div>
        )
      }
      hasImage={Boolean(watermarkUrl)}
      canManage={canManage}
      uploadAction={uploadWatermarkAction}
      removeAction={removeWatermarkAction}
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
