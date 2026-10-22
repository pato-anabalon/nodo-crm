"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EXPORT_COOKIE } from "./export-token";

// A file that never starts (an error page, a dropped connection) must not leave
// the button disabled for good.
const GIVE_UP_MS = 120_000;
const POLL_MS = 250;

function readCookie(name: string) {
  const prefix = `${name}=`;
  const found = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

// Only has to tell one click from the next, so it is not a secret. `randomUUID`
// exists only in a secure context, and the app is also opened over plain http
// (a LAN address, a phone), where calling it throws and the form never submits.
const newToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * The year picker and the download button.
 *
 * The answer to the form is a file, so the browser gives the page no event when
 * the download starts. The route says so itself: it echoes the token this form
 * posted into a cookie on the response that carries the file, and the form
 * waits for that cookie. Until then the button stays off, so the file can't be
 * asked for twice while it is being built.
 */
export function ExportForm({
  years,
  labels,
}: {
  years: number[];
  labels: { year: string; yearHint: string; download: string; preparing: string; preparingHint: string };
}) {
  const [pending, setPending] = useState(false);
  const tokenInput = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPending(false);
  };

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    const token = newToken();
    if (tokenInput.current) tokenInput.current.value = token;
    setPending(true);

    const startedAt = Date.now();
    timer.current = setInterval(() => {
      if (readCookie(EXPORT_COOKIE) === token || Date.now() - startedAt > GIVE_UP_MS) {
        document.cookie = `${EXPORT_COOKIE}=; Max-Age=0; Path=/`;
        stop();
      }
    }, POLL_MS);
  }

  return (
    // A plain GET: the answer is a file, so the browser downloads it and this
    // page stays where it is.
    <form action="/api/quotes/export" method="get" onSubmit={onSubmit} className="space-y-4">
      <input ref={tokenInput} type="hidden" name="token" />
      <div className="space-y-2">
        <Label htmlFor="year">{labels.year}</Label>
        <NativeSelect
          id="year"
          name="year"
          defaultValue={String(years[0])}
          className="w-auto"
          options={years.map((year) => ({ value: String(year), label: String(year) }))}
        />
        <p className="text-xs text-muted-foreground">{labels.yearHint}</p>
      </div>

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {labels.download}
      </Button>

      {pending ? (
        <div role="status" className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
            <Download className="relative size-4 animate-bounce" />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium">{labels.preparing}</p>
            <div className="h-1 overflow-hidden rounded-full bg-primary/15">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
            </div>
            <p className="text-xs text-muted-foreground">{labels.preparingHint}</p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
