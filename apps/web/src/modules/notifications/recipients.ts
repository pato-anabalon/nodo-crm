import { prisma } from "@/lib/db/prisma";
import { Language, MembershipStatus, type NotificationKind } from "@/generated/prisma/enums";
import { wantsNotice } from "./preferences";

/** Enough to address an email. A shared inbox is one of these and nothing more. */
export type Mailbox = {
  email: string;
  name: string | null;
  language: Language;
};

/**
 * Somebody with an account.
 *
 * Carries the id because the same list feeds both doorways: the email and the
 * bell. The extra addresses a company adds — a shared inbox, an office manager
 * with no account — are `Mailbox` and can only be sent to.
 */
export type Recipient = Mailbox & { id: string };

/**
 * Who to notify inside the company.
 *
 * If the lead has an owner, the notice is theirs: filling the rest of the team's
 * inbox is how people stop reading the emails. Only when nobody is assigned does
 * it go to those who see the whole book.
 */
export async function staffRecipients(input: {
  companyId: string;
  preferUserId?: string | null;
  permission: string;
  kind: NotificationKind;
}): Promise<Recipient[]> {
  const select = {
    user: {
      select: {
        id: true,
        email: true,
        name: true,
        language: true,
        notificationPreferences: {
          where: { companyId: input.companyId },
          select: { kind: true, enabled: true },
        },
      },
    },
  };

  if (input.preferUserId) {
    const owner = await prisma.membership.findFirst({
      where: {
        companyId: input.companyId,
        userId: input.preferUserId,
        status: MembershipStatus.ACTIVE,
      },
      select,
    });
    // Someone who turned this notice off gets nothing — not a fallback to the
    // whole team, which would be a strange way to honour their choice.
    if (owner) {
      return wantsNotice(owner.user.notificationPreferences, input.kind)
        ? [toRecipient(owner.user)]
        : [];
    }
  }

  const memberships = await prisma.membership.findMany({
    where: {
      companyId: input.companyId,
      status: MembershipStatus.ACTIVE,
      role: { permissions: { some: { permission: { key: input.permission } } } },
    },
    select,
    take: 20,
  });

  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const membership of memberships) {
    if (seen.has(membership.user.email)) continue;
    if (!wantsNotice(membership.user.notificationPreferences, input.kind)) continue;
    seen.add(membership.user.email);
    recipients.push(toRecipient(membership.user));
  }
  return recipients;
}

function toRecipient(user: {
  id: string;
  email: string;
  name: string | null;
  language: Language | null;
}): Recipient {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    language: user.language ?? Language.EN_GB,
  };
}

/** The company's default language, for anyone who hasn't chosen their own. */
export async function companyLanguage(companyId: string): Promise<Language> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { defaultLanguage: true },
  });
  return company?.defaultLanguage ?? Language.EN_GB;
}
