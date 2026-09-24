"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageAuthor } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import type { PortalActionState } from "./actions";
import { threadChanged, type ThreadMessage } from "./thread";

export type { ThreadMessage };

/**
 * How often the open thread asks for new messages.
 *
 * A quote conversation moves a few times an hour, not a few times a second, so
 * this buys a reply showing up within seconds without holding a connection open
 * for every customer reading a quote.
 */
const POLL_SECONDS = 10;

/**
 * The thread between the company and the customer inside a quote.
 *
 * `side` says who is looking, so their own messages align right: the same
 * component serves both the portal and the internal panel.
 */
export function MessageThread({
  messages: rendered,
  side,
  companyName,
  action,
  feedUrl,
}: {
  messages: ThreadMessage[];
  side: MessageAuthor;
  companyName: string;
  action: (prev: PortalActionState, formData: FormData) => Promise<PortalActionState>;
  /** Where to ask for new messages. Without it the thread stays as rendered. */
  feedUrl?: string;
}) {
  const t = useTranslations("portal");
  const formRef = useRef<HTMLFormElement>(null);
  const [fetched, setFetched] = useState<ThreadMessage[] | null>(null);

  /**
   * What the server rendered until the first poll answers, and the poll after
   * that. The fetched copy is never staler — it comes from the same database a
   * moment later — so it wins once it exists, and a reload starts over.
   */
  const messages = fetched ?? rendered;

  const refresh = useCallback(async () => {
    if (!feedUrl) return;
    try {
      const response = await fetch(feedUrl);
      if (!response.ok) return;
      const data = (await response.json()) as { messages: ThreadMessage[] };
      // Only swap when something actually arrived: replacing the array on every
      // poll would restart any text selection inside the thread.
      setFetched((current) =>
        current && !threadChanged(current, data.messages) ? current : data.messages,
      );
    } catch {
      // A failed poll isn't worth reporting: the next one is seconds away and
      // what's already on screen is still valid.
    }
  }, [feedUrl]);

  /**
   * Clearing the box and pulling the new message are part of sending, not a
   * reaction to it, so they happen here rather than in an effect watching the
   * result — which is also what makes two sends in a row behave the same as one.
   */
  const send = useCallback(
    async (prev: PortalActionState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.done) {
        formRef.current?.reset();
        await refresh();
      }
      return result;
    },
    [action, refresh],
  );

  const [state, formAction, sending] = useActionState<PortalActionState, FormData>(send, {});

  useEffect(() => {
    if (!feedUrl) return;

    const tick = () => {
      // Nobody is reading a tab that isn't on screen.
      if (document.visibilityState === "visible") void refresh();
    };

    const timer = setInterval(tick, POLL_SECONDS * 1000);
    // Coming back to the tab should show the reply straight away, not after the
    // next tick.
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [feedUrl, refresh]);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("messages")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("messagesBody")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : (
          <ol className="space-y-3">
            {messages.map((message) => {
              const mine = message.author === side;
              return (
                <li
                  key={message.id}
                  className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {message.body}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {mine
                      ? t("you")
                      : (message.authorName ??
                        (message.author === MessageAuthor.STAFF ? companyName : ""))}
                    {" · "}
                    {message.sentAtLabel}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <form ref={formRef} action={formAction} className="space-y-2">
          <Textarea name="body" rows={3} placeholder={t("messagePlaceholder")} required />
          {state.fieldErrors?.body ? (
            <p className="text-sm text-destructive">{state.fieldErrors.body[0]}</p>
          ) : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" size="sm" disabled={sending}>
            {sending ? t("sending") : t("send")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
