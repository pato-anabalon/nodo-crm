import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { createContactAction } from "@/modules/contacts/actions";
import { ContactForm } from "@/modules/contacts/contact-form";

export async function generateMetadata() {
  const t = await getTranslations("contacts");
  return { title: t("new") };
}

export default async function NewContactPage() {
  await requirePermission("contacts.create");
  const [t, tCommon] = await Promise.all([
    getTranslations("contacts"),
    getTranslations("common"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/contacts" aria-label={t("title")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{t("new")}</h1>
      </div>

      <ContactForm action={createContactAction} submitLabel={tCommon("save")} />
    </div>
  );
}
