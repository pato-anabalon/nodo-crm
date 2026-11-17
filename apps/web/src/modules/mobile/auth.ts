import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { activeCompaniesFor, type CompanyChoice } from "@/lib/auth/session";
import { languageToLocale } from "@/i18n/config";
import { Language, MembershipStatus } from "@/generated/prisma/enums";
import { sendNotice } from "@/modules/notifications/service";
import { forgetPushDevice } from "./push";
import { MobileError } from "./route";
import type { CodeSignIn, DeviceInput, PasswordSignIn } from "./schemas";
import {
  CODE_MAX_ATTEMPTS,
  CODE_MINUTES,
  CODES_PER_WINDOW,
  FAILURES_PER_EMAIL,
  FAILURES_PER_IP,
  challengeState,
  codeExpiry,
  codeMatches,
  generateCode,
  generateSessionToken,
  hashCode,
  hashDeviceId,
  maskEmail,
  sessionExpiry,
  trustExpiry,
  windowStart,
} from "./tokens";

/**
 * Signing in from the app: a password, then a code by email unless this phone
 * was trusted in the last 30 days. Google and Microsoft will skip the code —
 * the provider has its own second factor.
 *
 * Nobody gets a session, or a code, without an active membership in a company
 * that is switched on: the app has nothing to show them, and a code emailed to
 * somebody with no access is one of Resend's 100 a day spent on nothing.
 */

export type SignedIn = { kind: "session"; token: string; expiresAt: Date; companies: CompanyChoice[] };
export type CodeSent = { kind: "code"; challengeId: string; email: string; expiresAt: Date };

// Compared against when the email has no account, so a wrong email and a wrong
// password take the same time to refuse.
let decoy: string | null = null;
const decoyHash = () => (decoy ??= bcrypt.hashSync("not-a-password", 10));

export async function signInWithPassword(
  input: PasswordSignIn,
  ipAddress: string | null,
  now: Date = new Date(),
): Promise<SignedIn | CodeSent> {
  const email = input.email.trim().toLowerCase();
  const since = windowStart(now);

  const [byEmail, byIp] = await Promise.all([
    prisma.mobileLoginFailure.count({ where: { email, createdAt: { gte: since } } }),
    ipAddress ? prisma.mobileLoginFailure.count({ where: { ipAddress, createdAt: { gte: since } } }) : 0,
  ]);
  if (byEmail >= FAILURES_PER_EMAIL || byIp >= FAILURES_PER_IP) throw new MobileError(429, "too_many_attempts");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, language: true, passwordHash: true },
  });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? decoyHash());
  if (!user?.passwordHash || !valid) {
    await prisma.mobileLoginFailure.create({ data: { email, ipAddress } });
    throw new MobileError(401, "invalid_credentials");
  }

  const companies = await activeCompaniesFor(user.id);
  if (companies.length === 0) throw new MobileError(403, "no_access");

  const deviceIdHash = hashDeviceId(input.deviceId);
  const trusted = await prisma.mobileTrustedDevice.findFirst({
    where: { userId: user.id, deviceIdHash, trustedUntil: { gt: now } },
    select: { id: true },
  });
  if (trusted) return { kind: "session", ...(await issueSession(user.id, input, now)), companies };

  return sendCode(user, deviceIdHash, ipAddress, now);
}

async function sendCode(
  user: { id: string; email: string; name: string | null; language: Language | null },
  deviceIdHash: string,
  ipAddress: string | null,
  now: Date,
): Promise<CodeSent> {
  const recent = await prisma.mobileChallenge.count({ where: { userId: user.id, createdAt: { gte: windowStart(now) } } });
  if (recent >= CODES_PER_WINDOW) throw new MobileError(429, "too_many_codes");

  const secret = codeSecret();
  const code = generateCode();
  const expiresAt = codeExpiry(now);
  // The id is part of the hash, so the row is created first and the hash written once it exists.
  const challenge = await prisma.mobileChallenge.create({
    data: { userId: user.id, codeHash: "", deviceIdHash, ipAddress, expiresAt },
    select: { id: true },
  });
  await prisma.mobileChallenge.update({
    where: { id: challenge.id },
    data: { codeHash: hashCode(challenge.id, code, secret) },
  });

  const language = user.language ?? (await firstCompanyLanguage(user.id));
  const t = await getTranslations({ locale: languageToLocale(language), namespace: "mobile.code" });
  const values = { code, minutes: CODE_MINUTES };
  const sent = await sendNotice({
    to: { email: user.email, name: user.name, language },
    companyName: "Nodo CRM",
    subject: t("subject", values),
    heading: t("heading", values),
    lines: [t("line1", values), t("line2", values)],
  });

  // Locally the code also goes to the terminal, sent or not: the demo users'
  // addresses reach nobody, and a real one shouldn't need a trip to the inbox
  // to try the flow. Never in production (Vercel's previews included).
  if (process.env.NODE_ENV !== "production") console.info(`[mobile] sign-in code for ${user.email}: ${code}`);
  if (!sent && process.env.NODE_ENV === "production") throw new MobileError(503, "code_not_sent");

  return { kind: "code", challengeId: challenge.id, email: maskEmail(user.email), expiresAt };
}

export async function signInWithCode(input: CodeSignIn, now: Date = new Date()): Promise<SignedIn> {
  const deviceIdHash = hashDeviceId(input.deviceId);
  const challenge = await prisma.mobileChallenge.findUnique({
    where: { id: input.challengeId },
    select: { id: true, userId: true, codeHash: true, deviceIdHash: true, attempts: true, expiresAt: true, consumedAt: true },
  });

  const state = challengeState(challenge, deviceIdHash, now);
  if (state === "expired") throw new MobileError(401, "code_expired");
  if (state === "locked") throw new MobileError(401, "too_many_attempts");
  // Not found, already used, or asked for by another phone: one answer for all three.
  if (state !== "ok" || !challenge) throw new MobileError(401, "invalid_code");

  if (!codeMatches(challenge.codeHash, challenge.id, input.code, codeSecret())) {
    const { attempts } = await prisma.mobileChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    throw new MobileError(401, "invalid_code", { remaining: Math.max(0, CODE_MAX_ATTEMPTS - attempts) });
  }

  // Only the first to claim it counts: two presses of the button are one sign-in.
  const claimed = await prisma.mobileChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (claimed.count === 0) throw new MobileError(401, "invalid_code");

  // Checked again: an owner may have suspended them in the ten minutes in between.
  const companies = await activeCompaniesFor(challenge.userId);
  if (companies.length === 0) throw new MobileError(403, "no_access");

  if (input.trustDevice) {
    await prisma.mobileTrustedDevice.upsert({
      where: { userId_deviceIdHash: { userId: challenge.userId, deviceIdHash } },
      create: { userId: challenge.userId, deviceIdHash, trustedUntil: trustExpiry(now) },
      update: { trustedUntil: trustExpiry(now) },
    });
  }

  return { kind: "session", ...(await issueSession(challenge.userId, input, now)), companies };
}

/** Signing out of this phone only; the others stay signed in. Its notices stop with it. */
export async function signOut(sessionId: string, now: Date = new Date()): Promise<void> {
  await prisma.mobileSession.update({ where: { id: sessionId }, data: { revokedAt: now } });
  await forgetPushDevice(sessionId);
}

async function issueSession(userId: string, device: DeviceInput, now: Date) {
  const { token, tokenHash } = generateSessionToken();
  const expiresAt = sessionExpiry(now);
  await prisma.mobileSession.create({
    data: {
      userId,
      tokenHash,
      deviceIdHash: hashDeviceId(device.deviceId),
      deviceName: device.deviceName || null,
      platform: device.platform,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

async function firstCompanyLanguage(userId: string): Promise<Language> {
  const membership = await prisma.membership.findFirst({
    where: { userId, status: MembershipStatus.ACTIVE, company: { isActive: true } },
    select: { company: { select: { defaultLanguage: true } } },
    orderBy: { createdAt: "asc" },
  });
  return membership?.company.defaultLanguage ?? Language.EN_GB;
}

function codeSecret(): string {
  const secret = process.env.AUTH_SECRET;
  // Without it every code would be hashed with the same public value.
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}
