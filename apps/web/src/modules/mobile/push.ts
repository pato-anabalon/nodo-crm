import { prisma } from "@/lib/db/prisma";

/**
 * This phone's push token, held against its session. A token already held by
 * another session — the same phone signed in as somebody else since — moves
 * here, so it stops receiving the previous person's notices.
 */
export async function registerPushDevice(sessionId: string, expoToken: string, platform: string): Promise<void> {
  await prisma.pushDevice.deleteMany({ where: { expoToken, NOT: { sessionId } } });
  await prisma.pushDevice.upsert({
    where: { sessionId },
    create: { sessionId, expoToken, platform },
    update: { expoToken, platform },
  });
}

export async function forgetPushDevice(sessionId: string): Promise<void> {
  await prisma.pushDevice.deleteMany({ where: { sessionId } });
}
