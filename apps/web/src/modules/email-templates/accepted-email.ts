import { EmailTemplateKind } from "@/generated/prisma/enums";
import { sendToCustomer } from "./customer-send";

/**
 * Confirms to the customer that their acceptance landed.
 *
 * Until this existed they pressed accept and heard nothing, while the only
 * people told were the team — a commercial commitment that produces silence
 * reads like a form that didn't submit.
 *
 * It carries no button. The only customer-facing URL is the share token, which
 * cannot be read back from its hash, and the team's own route would land them on
 * a login screen. They pressed accept a second ago; a button that goes nowhere
 * useful is worse than none.
 */
export async function sendAcceptedEmail(quoteId: string): Promise<void> {
  await sendToCustomer(quoteId, EmailTemplateKind.QUOTE_ACCEPTED);
}
