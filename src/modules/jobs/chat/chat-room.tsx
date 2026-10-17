"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, SendHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/confirm-button";
import { cn } from "@/lib/utils";
import type { JobActionState } from "../actions";
import type { FormAction } from "../docs/name-dialogs";
import { PersonAvatar, personName, type Person } from "../avatars";
import { AttachmentField, AttachmentGallery } from "../board/attachments";
import { mentionQuery, type ChatSegment, type Mentionable } from "./text";
import type { ChatFeed, ChatMessageView } from "./view";

/** How often an open chat asks for news, while its tab is on screen. */
const POLL_MS = 5000;
/** Messages from one person closer together than this read as one run. */
const RUN_MS = 5 * 60 * 1000;
/** How close to the bottom still counts as "reading the latest". */
const NEAR_BOTTOM_PX = 80;

type Pending = { key: number; text: string; files: number };

type FeedState = {
  /** Pages loaded with "show earlier", and messages the latest page has since moved past. */
  older: ChatMessageView[];
  /** The latest page, replaced by every poll. */
  latest: ChatMessageView[];
  /** Whether anything comes before the earliest message on screen. */
  hasEarlier: boolean;
};

const sameIds = (a: ChatMessageView[], b: ChatMessageView[]) =>
  a.length === b.length && a.every((message, i) => message.id === b[i].id);

/** A touch screen has no Shift + Enter, so there Enter is a new line and the button sends. */
function useTouchKeyboard(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

/**
 * A job's chat: the conversation, kept up to date by polling while it is on
 * screen, and the box to write in.
 *
 * What is sent shows at once, dimmed, until the server's copy arrives with the
 * next read — which the send itself triggers, so nobody waits for a tick.
 * Scrolling stays at the bottom only for somebody already there: a message
 * arriving must not yank away whoever scrolled up to read.
 */
export function ChatRoom({
  jobId,
  prefix,
  initial,
  people,
  me,
  canPost,
  onSend,
  onDelete,
}: {
  jobId: string;
  prefix: string;
  initial: ChatFeed;
  people: Mentionable[];
  me: Person;
  canPost: boolean;
  onSend: FormAction;
  onDelete: (messageId: string) => Promise<JobActionState>;
}) {
  const t = useTranslations("jobs.chat");
  const [feed, setFeed] = useState<FeedState>({ older: [], latest: initial.messages, hasEarlier: initial.hasEarlier });
  const [pending, addPending] = useOptimistic<Pending[], Pending>([], (current, next) => [...current, next]);
  const [, startTransition] = useTransition();
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  /** Distance from the bottom to keep while earlier messages are added above. */
  const keepFromBottom = useRef<number | null>(null);
  const nextKey = useRef(0);

  const messages = useMemo(() => {
    const latestIds = new Set(feed.latest.map((message) => message.id));
    return [...feed.older.filter((message) => !latestIds.has(message.id)), ...feed.latest];
  }, [feed]);

  const applyLatest = useCallback((next: ChatFeed) => {
    setFeed((current) => {
      if (sameIds(current.latest, next.messages)) return current;
      // Messages the latest page no longer reaches stay on screen as older
      // ones; anything newer than its first that is missing was deleted.
      const nextIds = new Set(next.messages.map((message) => message.id));
      const first = next.messages[0]?.createdAt;
      const older = first
        ? [...current.older, ...current.latest].filter((message) => !nextIds.has(message.id) && message.createdAt < first)
        : [];
      return { older, latest: next.messages, hasEarlier: older.length > 0 ? current.hasEarlier : next.hasEarlier };
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/chat`);
      if (response.ok) applyLatest((await response.json()) as ChatFeed);
    } catch {
      // The next tick is seconds away and what is on screen is still true.
    }
  }, [jobId, applyLatest]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (keepFromBottom.current !== null) {
      element.scrollTop = element.scrollHeight - keepFromBottom.current;
      keepFromBottom.current = null;
    } else if (atBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, pending]);

  // Arriving from a notice: the message it is about, in the middle of the screen.
  useEffect(() => {
    const id = window.location.hash.replace(/^#message-/, "");
    if (!id || id === window.location.hash) return;
    const element = document.getElementById(`message-${id}`);
    if (!element) return;
    element.scrollIntoView({ block: "center" });
    atBottom.current = false;
    const timer = setTimeout(() => setHighlighted(id), 0);
    return () => clearTimeout(timer);
  }, []);

  async function loadEarlier() {
    const first = messages[0];
    const element = scroller.current;
    if (!first || !element) return;
    setLoadingEarlier(true);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/chat?before=${encodeURIComponent(first.id)}`);
      if (!response.ok) return;
      const page = (await response.json()) as ChatFeed;
      keepFromBottom.current = element.scrollHeight - element.scrollTop;
      setFeed((current) => {
        const known = new Set([...current.older, ...current.latest].map((message) => message.id));
        return {
          ...current,
          older: [...page.messages.filter((message) => !known.has(message.id)), ...current.older],
          hasEarlier: page.hasEarlier,
        };
      });
    } catch {
      // Pressing it again is the retry.
    } finally {
      setLoadingEarlier(false);
    }
  }

  function send(formData: FormData, text: string, files: number) {
    atBottom.current = true;
    startTransition(async () => {
      addPending({ key: nextKey.current++, text, files });
      const result = await onSend({}, formData);
      if (result.error) toast.error(result.error);
      await refresh();
    });
  }

  function remove(messageId: string) {
    startTransition(async () => {
      const result = await onDelete(messageId);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
      await refresh();
    });
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-96 flex-col overflow-hidden rounded-xl border bg-card">
      <div
        ref={scroller}
        className="flex-1 overflow-y-auto px-2 py-3 sm:px-4"
        onScroll={(event) => {
          const element = event.currentTarget;
          atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
        }}
      >
        {feed.hasEarlier ? (
          <div className="flex justify-center pb-3">
            <Button type="button" variant="outline" size="sm" onClick={loadEarlier} disabled={loadingEarlier}>
              {loadingEarlier ? <Loader2 className="size-4 animate-spin" /> : null}
              {loadingEarlier ? t("loading") : t("loadEarlier")}
            </Button>
          </div>
        ) : null}

        {messages.length === 0 && pending.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm italic text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ol className="space-y-0.5">
            {messages.map((message, i) => {
              const previous = messages[i - 1];
              const newDay = !previous || previous.day !== message.day;
              const run =
                !newDay &&
                previous.author?.id === message.author?.id &&
                Date.parse(message.createdAt) - Date.parse(previous.createdAt) < RUN_MS;
              return (
                <li key={message.id} className="list-none">
                  {newDay ? <DayHeading label={message.dayLabel} /> : null}
                  <MessageRow
                    message={message}
                    continued={run}
                    meId={me.id}
                    highlighted={highlighted === message.id}
                    onDelete={message.canDelete ? () => remove(message.id) : null}
                  />
                </li>
              );
            })}
            {pending.map((item, i) => (
              <li key={item.key} className="list-none">
                <PendingRow item={item} me={me} continued={i > 0 || messages.at(-1)?.author?.id === me.id} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {canPost ? (
        <Composer jobId={jobId} prefix={prefix} people={people} meId={me.id} onSend={send} />
      ) : (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
    </div>
  );
}

function DayHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="h-px flex-1 bg-border" />
      <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function MessageRow({
  message,
  continued,
  meId,
  highlighted,
  onDelete,
}: {
  message: ChatMessageView;
  continued: boolean;
  meId: string;
  highlighted: boolean;
  onDelete: (() => void) | null;
}) {
  const t = useTranslations("jobs.chat");
  const name = message.author ? personName(message.author) : t("someone");
  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        "group flex scroll-mt-4 gap-3 rounded-md px-2 py-1 hover:bg-muted/50",
        !continued && "mt-2",
        highlighted && "bg-amber-100/70 hover:bg-amber-100/70 dark:bg-amber-500/15 dark:hover:bg-amber-500/15",
      )}
    >
      <div className="w-8 shrink-0">
        {continued ? (
          <span className="block pt-0.5 text-[0.65rem] text-muted-foreground opacity-0 group-hover:opacity-100">
            {message.time}
          </span>
        ) : message.author ? (
          <PersonAvatar person={message.author} size="sm" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {continued ? null : (
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">{message.time}</span>
          </p>
        )}
        {message.segments.length > 0 ? (
          <p className="text-sm break-words whitespace-pre-wrap">
            <Segments segments={message.segments} meId={meId} />
          </p>
        ) : null}
        {message.files.length > 0 ? <AttachmentGallery files={message.files} className="max-w-xl" /> : null}
      </div>
      {onDelete ? (
        <ConfirmButton
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
            >
              <Trash2 className="size-4" />
              <span className="sr-only">{t("deleteMessage")}</span>
            </Button>
          }
          title={t("deleteTitle")}
          description={t("deleteBody")}
          confirmLabel={t("deleteMessage")}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  );
}

function Segments({ segments, meId }: { segments: ChatSegment[]; meId: string }) {
  return segments.map((segment, i) => {
    if (segment.type === "link") {
      return (
        <a
          key={i}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-(--brand-ink) underline underline-offset-2"
        >
          {segment.text}
        </a>
      );
    }
    if (segment.type === "mention") {
      return (
        <span
          key={i}
          className={cn(
            "rounded px-0.5 font-medium text-(--brand-ink)",
            segment.userId === meId ? "bg-primary/20" : "bg-primary/10",
          )}
        >
          {segment.text}
        </span>
      );
    }
    return <span key={i}>{segment.text}</span>;
  });
}

function PendingRow({ item, me, continued }: { item: Pending; me: Person; continued: boolean }) {
  const t = useTranslations("jobs.chat");
  return (
    <div className={cn("flex gap-3 px-2 py-1 opacity-60", !continued && "mt-2")}>
      <div className="w-8 shrink-0">{continued ? null : <PersonAvatar person={me} size="sm" />}</div>
      <div className="min-w-0 flex-1 space-y-1">
        {continued ? null : <p className="text-sm font-semibold">{personName(me)}</p>}
        {item.text ? <p className="text-sm break-words whitespace-pre-wrap">{item.text}</p> : null}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {item.files > 0 ? `${t("attachmentsOnly", { count: item.files })} · ` : null}
          {t("sending")}
        </p>
      </div>
    </div>
  );
}

function filesIn(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string" || raw === "") return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * The box at the bottom. Typing `@` offers the people on the job; picking one
 * writes their whole name, which is what the server looks for to know who was
 * mentioned. The attachment field starts over after each send by changing its
 * key, the same way a comment box does.
 */
function Composer({
  jobId,
  prefix,
  people,
  meId,
  onSend,
}: {
  jobId: string;
  prefix: string;
  people: Mentionable[];
  meId: string;
  onSend: (formData: FormData, text: string, files: number) => void;
}) {
  const t = useTranslations("jobs.chat");
  const touch = useTouchKeyboard();
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  const [round, setRound] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [active, setActive] = useState({ key: "", index: 0 });
  const textarea = useRef<HTMLTextAreaElement>(null);

  const query = mentionQuery(draft.slice(0, caret));
  const options = useMemo(() => {
    if (!query) return [];
    const q = query.query.toLowerCase();
    return people
      .filter((person) => person.id !== meId)
      .filter((person) => person.name.toLowerCase().split(/\s+/).some((word) => word.startsWith(q)) || person.name.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [people, meId, query]);
  const open = query !== null && options.length > 0 && dismissedAt !== query.start;
  const queryKey = query ? `${query.start}:${query.query}` : "";
  const activeIndex = active.key === queryKey ? Math.min(active.index, options.length - 1) : 0;

  function pick(person: Mentionable) {
    if (!query) return;
    const before = draft.slice(0, query.start);
    const insert = `@${person.name} `;
    const next = before + insert + draft.slice(caret);
    const position = before.length + insert.length;
    setDraft(next);
    setCaret(position);
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(position, position);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive({ key: queryKey, index: (activeIndex + step + options.length) % options.length });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(options[activeIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedAt(query!.start);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey && !touch && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = draft.trim();
    const files = filesIn(formData.get("attachments"));
    if (!text && files === 0) return;
    onSend(formData, text, files);
    setDraft("");
    setCaret(0);
    setDismissedAt(null);
    setRound((n) => n + 1);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 border-t bg-card p-2 sm:p-3">
      <div className="relative flex items-end gap-2">
        {open ? (
          <ul
            role="listbox"
            aria-label={t("mentionList")}
            className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-md border bg-popover py-1 text-sm shadow-md"
          >
            {options.map((person, i) => (
              <li
                key={person.id}
                role="option"
                aria-selected={i === activeIndex}
                className={cn("cursor-pointer truncate px-3 py-1.5", i === activeIndex && "bg-accent text-accent-foreground")}
                onMouseDown={(event) => {
                  // Before the textarea loses focus, so the caret is still where it was.
                  event.preventDefault();
                  pick(person);
                }}
                onMouseEnter={() => setActive({ key: queryKey, index: i })}
              >
                {person.name}
              </li>
            ))}
          </ul>
        ) : null}
        <Textarea
          ref={textarea}
          name="body"
          rows={1}
          value={draft}
          aria-label={t("message")}
          placeholder={t("placeholder")}
          className="max-h-48 min-h-10 resize-none"
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setCaret(event.currentTarget.selectionStart);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" size="icon" className="shrink-0">
          <SendHorizontal className="size-4" />
          <span className="sr-only">{t("send")}</span>
        </Button>
      </div>
      <AttachmentField key={round} jobId={jobId} prefix={prefix} hint={touch ? t("hintTouch") : t("hint")} />
    </form>
  );
}
