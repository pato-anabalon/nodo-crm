import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { requireJobContext } from "@/modules/jobs/access";
import { jobUploadPrefix } from "@/modules/jobs/files";
import { chatPage, mentionablePeople } from "@/modules/jobs/chat/service";
import { chatFeed } from "@/modules/jobs/chat/view";
import { deleteChatMessageAction, sendChatMessageAction } from "@/modules/jobs/chat/actions";
import { ChatRoom } from "@/modules/jobs/chat/chat-room";

export async function generateMetadata() {
  const t = await getTranslations("jobs.chat");
  return { title: t("title") };
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, job } = await requireJobContext(id, "chat.read");
  const [t, page, people] = await Promise.all([
    getTranslations("jobs.chat"),
    chatPage(ctx, job.id),
    mentionablePeople(ctx, job.id),
  ]);
  const feed = chatFeed(page, {
    formatLocale: ctx.company.formatLocale,
    timezone: ctx.company.timezone,
    viewer: { userId: ctx.user.id, permissions: ctx.permissions },
  });

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={`/jobs/${job.id}`} aria-label={t("backToJob", { name: job.name })}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>

      <ChatRoom
        jobId={job.id}
        prefix={jobUploadPrefix(ctx.company.id, job.id)}
        initial={feed}
        people={people}
        me={{ id: ctx.user.id, name: ctx.user.name ?? null, email: ctx.user.email, image: ctx.user.image ?? null }}
        canPost={can(ctx, "chat.create")}
        onSend={sendChatMessageAction.bind(null, job.id)}
        onDelete={deleteChatMessageAction}
      />
    </div>
  );
}
