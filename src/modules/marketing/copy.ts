import type messages from "../../../messages/en-GB.json";

/**
 * The shapes of the public page's copy, read from the British English file:
 * both languages hold the same keys (a test says so), so either fits. Client
 * components are handed these whole, already in the reader's language.
 */
type Marketing = (typeof messages)["marketing"];

export type NavCopy = Marketing["nav"];
export type HeroCopy = Marketing["hero"];
export type EnquiriesCopy = Marketing["enquiries"];
export type QuotesCopy = Marketing["quotes"];
export type JobsCopy = Marketing["jobs"];
export type RowsCopy = Marketing["rows"];
