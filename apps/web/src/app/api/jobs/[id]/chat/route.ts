import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/session";
import { jobAccess } from "@/modules/jobs/access";
import { chatPage } from "@/modules/jobs/chat/service";
import { chatFeed } from "@/modules/jobs/chat/view";

/**
 * The chat's feed: the latest page, which the screen polls while it is open,
 * or with `?before=<messageId>` the page before it, for "show earlier".
 *
 * Polling rather than a socket, like the quote's thread: a job's chat moves a
 * few times an hour, and a request every few seconds from the people actually
 * looking at it costs less than a connection held open for everybody. It
 * answers through the same guard and draws through the same `chatFeed` as the
 * page, so a message that arrives by poll reads exactly like one rendered.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getCompanyContext();
  if (!ctx) return new NextResponse(null, { status: 401 });

  const { id } = await context.params;
  const job = await jobAccess(ctx, id, "chat.read");
  if (!job) return new NextResponse(null, { status: 404 });

  const before = new URL(request.url).searchParams.get("before");
  const page = await chatPage(ctx, job.id, before);
  return NextResponse.json(
    chatFeed(page, {
      formatLocale: ctx.company.formatLocale,
      timezone: ctx.company.timezone,
      viewer: { userId: ctx.user.id, permissions: ctx.permissions },
    }),
  );
}
