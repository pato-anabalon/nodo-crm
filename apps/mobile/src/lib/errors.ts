import { useTranslations } from "use-intl";
import { ApiError } from "./api";

/** The codes the app has words for; anything else reads as "something went wrong". */
const KNOWN = new Set([
  "invalid_credentials",
  "too_many_attempts",
  "too_many_codes",
  "no_access",
  "code_expired",
  "invalid_code",
  "code_not_sent",
  "unauthenticated",
  "network",
  "job_closed",
  "not_found",
  "forbidden",
  "files_refused",
]);

export function errorKey(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "generic";
  return KNOWN.has(code) ? code : "generic";
}

/** A refusal in the reader's language — the server only ever sends its code. */
export function useErrorText() {
  const t = useTranslations("mobile.errors");
  return (error: unknown) => t(errorKey(error) as "generic");
}

/** A field's first error, which the server sends as a `validation.*` key. */
export function useFieldError() {
  const t = useTranslations();
  return (error: unknown, field: string): string | undefined => {
    const key = error instanceof ApiError ? error.fields[field]?.[0] : undefined;
    return key ? t(key as never) : undefined;
  };
}
