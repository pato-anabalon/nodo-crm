import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/components/company-logo";
import { BrandImageCard } from "@/modules/settings/brand-image-card";
import { removeAvatarAction, uploadAvatarAction } from "./actions";

/**
 * The same `BrandImageCard` the company's logo and watermark use — upload,
 * preview and remove all wired once there, and a user's photo is the same
 * shape of thing: one image, replaced by re-upload, with initials standing
 * in for none.
 */
export async function AvatarManager({ name, image }: { name: string; image: string | null }) {
  const t = await getTranslations("account.avatar");

  return (
    <BrandImageCard
      kind="avatar"
      preview={
        <Avatar className="size-14">
          {image ? <AvatarImage src={image} alt={name} /> : null}
          <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
        </Avatar>
      }
      hasImage={Boolean(image)}
      canManage
      uploadAction={uploadAvatarAction}
      removeAction={removeAvatarAction}
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
