-- ADD COLUMN "viewing": an explicit "still here" flag, set true by the
-- heartbeat and false the instant the customer's tab sends its own "leaving"
-- signal (pagehide), instead of only ever finding out via the presence window
-- running out.
ALTER TABLE "QuoteShare" ADD COLUMN "viewing" BOOLEAN NOT NULL DEFAULT false;
