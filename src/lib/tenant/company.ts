import { cache } from "react";
import { prisma } from "@/lib/db/prisma";

/**
 * The company's public details (name, logo, colours) so the brand can be painted
 * before a session exists: the login screen should already look like theirs.
 */
export const getCompanyBySlug = cache(async (slug: string) => {
  return prisma.company.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
    },
  });
});
