import { SenderNameStyle } from "@/generated/prisma/enums";

/**
 * The name the customer reads in the From line.
 *
 * A *shape* is stored, never a name. Quotient keeps the literal "Rolando
 * Reveco" because an account there is one person; a company here is a team, and
 * a stored name would sign María's quote as Rolando. So the name is worked out
 * on every send, from whoever is behind it.
 *
 * The address is not part of this: every company sends from the platform's
 * verified domain until it verifies its own.
 */
export function senderName(
  style: SenderNameStyle,
  input: {
    companyName: string;
    /** Whoever is behind this send. Absent for anything a scheduler sends. */
    userName?: string | null;
    /** "from", "de" — customer-facing, so it follows the quote's language. */
    connector: string;
  },
): string {
  const person = input.userName?.trim();

  // No person to name — a nightly follow-up on a quote whose author is gone.
  // Falling back to the company is right: the alternative is a blank sender, and
  // the company is who the email is from either way.
  if (!person) return input.companyName;

  switch (style) {
    case SenderNameStyle.USER:
      return person;

    case SenderNameStyle.USER_AND_COMPANY:
      // The first name only, as Quotient does: "Rolando from PlasterPro
      // Solution Limited" already runs long, and a From line that gets cut off
      // is worse than one that is a little informal.
      return `${firstName(person)} ${input.connector} ${input.companyName}`;

    case SenderNameStyle.COMPANY:
    default:
      return input.companyName;
  }
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] ?? full;
}
