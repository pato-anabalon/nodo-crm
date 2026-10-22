/**
 * The cookie the export route sets on the response that carries the file, so
 * the page that asked for it can tell the download has started. Its value is
 * the token the form posted.
 */
export const EXPORT_COOKIE = "quotes_export_started";

/** A token we are willing to echo into a cookie: short, and nothing but safe characters. */
export const isExportToken = (value: string | null): value is string => value !== null && /^[\w-]{8,64}$/.test(value);
