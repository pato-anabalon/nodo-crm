import { Resend } from "resend";
import { formatAddress } from "./address";

/**
 * The Resend client.
 *
 * Returns null when the API key is missing, so the app keeps working locally or
 * before the email setup is finished: in that case the actions report that the
 * send is pending instead of failing.
 */
let client: Resend | null = null;

export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
  if (!apiKey) return null;

  client ??= new Resend(apiKey);
  return client;
}

/**
 * The sender for a company's emails.
 *
 * The display name is the company's and the address is the platform's:
 * "Acme Ltd <no-reply@nodo.co.nz>". Later, once each company verifies its own
 * domain, the address will be theirs too.
 */
export function defaultFrom(companyName: string): string {
  const address = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  return formatAddress(companyName, address);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY);
}
