/** The platform's own screens are read in the same place as the rest: New Zealand. */
export const DATE = new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeZone: "Pacific/Auckland" });

export const DATE_TIME = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Pacific/Auckland",
});
