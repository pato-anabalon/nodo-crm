"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { IngestKeyType } from "@/generated/prisma/enums";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { generateIngestKey } from "./keys";
import { normalizeOrigin } from "./origins";

export type IngestKeyState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** The full token, shown only once, right after creating it. */
  token?: string;
};

const createKeySchema = z.object({
  name: z.string().trim().min(2, "ingest.errors.nameRequired").max(80),
  type: z.nativeEnum(IngestKeyType),
  origins: z.string().trim().optional(),
});

export async function createIngestKeyAction(
  _prev: IngestKeyState,
  formData: FormData,
): Promise<IngestKeyState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = createKeySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    origins: formData.get("origins"),
  });

  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  // One domain per line, or comma-separated — whichever is easier to type.
  const origins = (parsed.data.origins ?? "")
    .split(/[\n,]+/)
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  // Without a domain list, a public key is an open key.
  if (parsed.data.type === IngestKeyType.PUBLIC && origins.length === 0) {
    return { fieldErrors: { origins: [t("ingest.errors.originsRequired")] } };
  }

  const generated = generateIngestKey(parsed.data.type);

  await ctx.db.ingestKey.create({
    data: {
      companyId: ctx.company.id,
      name: parsed.data.name,
      type: parsed.data.type,
      prefix: generated.prefix,
      hashedSecret: generated.hashedSecret,
      allowedOrigins: origins,
      createdById: ctx.user.id,
    },
  });

  revalidatePath("/settings/api");
  return { token: generated.token };
}

export async function revokeIngestKeyAction(id: string): Promise<IngestKeyState> {
  const ctx = await requirePermission("settings.update");

  // Revoke rather than delete: the submissions that came in through this key must
  // keep knowing where they came from.
  const { count } = await ctx.db.ingestKey.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings/api");
  if (count === 0) {
    const t = await getTranslations("ingest");
    return { error: t("errors.notFound") };
  }
  return {};
}
