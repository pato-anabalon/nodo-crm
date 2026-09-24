/**
 * Reading the form that arrives through the API.
 *
 * Every company has its own and names the fields however it likes, so no format
 * can be demanded: the whole payload is stored, and on top of that the standard
 * fields are extracted by recognising the most common names — those are what
 * make filtering and searching possible afterwards.
 */

/** Common names for each field, in English and Spanish. Order is priority. */
const ALIASES = {
  name: ["name", "fullname", "full_name", "yourname", "your_name", "contactname", "nombre"],
  firstName: ["firstname", "first_name", "fname", "givenname"],
  lastName: ["lastname", "last_name", "lname", "surname", "familyname"],
  email: ["email", "e-mail", "emailaddress", "email_address", "youremail", "your_email", "correo"],
  phone: ["phone", "telephone", "mobile", "tel", "phonenumber", "phone_number", "telefono", "celular"],
  companyName: ["company", "companyname", "company_name", "business", "organisation", "organization", "empresa"],
  message: ["message", "comments", "comment", "enquiry", "inquiry", "details", "description", "mensaje", "consulta"],
  serviceType: ["service", "servicetype", "service_type", "jobtype", "job_type", "servicio", "subject"],
  address: ["address", "location", "suburb", "streetaddress", "street_address", "direccion", "ciudad", "city"],
} as const;

/** Honeypot fields: if they arrive filled, a bot answered. */
const HONEYPOT_FIELDS = [
  "honeypot",
  "_honey",
  "_gotcha",
  "bot-field",
  "bot_field",
  "fax",
  "leave-blank",
  "leave_blank",
];

const UTM_FIELDS = {
  utmSource: ["utm_source", "utmsource"],
  utmMedium: ["utm_medium", "utmmedium"],
  utmCampaign: ["utm_campaign", "utmcampaign"],
} as const;

const SOURCE_FIELDS = {
  sourceUrl: ["source_url", "sourceurl", "page_url", "pageurl", "url", "page"],
  referrer: ["referrer", "referer", "ref"],
} as const;

export type NormalizedSubmission = {
  name: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  message: string | null;
  serviceType: string | null;
  address: string | null;
  sourceUrl: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

/** Index of the payload by lowercase key with separators stripped. */
function index(payload: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();

  for (const [key, value] of Object.entries(payload)) {
    const text = toText(value);
    if (text === "") continue;

    const plain = key.toLowerCase();
    if (!map.has(plain)) map.set(plain, text);

    // `your-name`, `your_name` and `yourName` must all resolve the same.
    const squashed = plain.replace(/[-_\s]/g, "");
    if (!map.has(squashed)) map.set(squashed, text);
  }

  return map;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "";
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value).trim();
}

function pick(map: Map<string, string>, aliases: readonly string[]): string | null {
  for (const alias of aliases) {
    const value = map.get(alias) ?? map.get(alias.replace(/[-_]/g, ""));
    if (value) return value;
  }
  return null;
}

export function normalizeSubmission(payload: Record<string, unknown>): NormalizedSubmission {
  const map = index(payload);

  // A form split into first and last name is joined for the standard field.
  const first = pick(map, ALIASES.firstName);
  const last = pick(map, ALIASES.lastName);
  const composed = [first, last].filter(Boolean).join(" ").trim();

  return {
    name: pick(map, ALIASES.name) ?? (composed || null),
    email: normalizeEmail(pick(map, ALIASES.email)),
    phone: pick(map, ALIASES.phone),
    companyName: pick(map, ALIASES.companyName),
    message: pick(map, ALIASES.message),
    serviceType: pick(map, ALIASES.serviceType),
    address: pick(map, ALIASES.address),
    sourceUrl: pick(map, SOURCE_FIELDS.sourceUrl),
    referrer: pick(map, SOURCE_FIELDS.referrer),
    utmSource: pick(map, UTM_FIELDS.utmSource),
    utmMedium: pick(map, UTM_FIELDS.utmMedium),
    utmCampaign: pick(map, UTM_FIELDS.utmCampaign),
  };
}

function normalizeEmail(value: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  // Deliberately lax validation: a mistyped email shouldn't cost the lead, only
  // leave the standard field empty.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : null;
}

export function isHoneypotFilled(payload: Record<string, unknown>): boolean {
  const map = index(payload);
  return HONEYPOT_FIELDS.some((field) => {
    const value = map.get(field) ?? map.get(field.replace(/[-_]/g, ""));
    return Boolean(value);
  });
}

/**
 * The lead's title, built from whatever arrived.
 *
 * A lead with no title is unreadable in the inbox, so it's assembled from the
 * best available material before falling back to something generic.
 */
export function buildLeadTitle(data: NormalizedSubmission, fallback: string): string {
  const who = data.companyName ?? data.name;
  if (data.serviceType && who) return `${data.serviceType} — ${who}`;
  if (data.serviceType) return data.serviceType;
  if (who) return who;
  if (data.message) return data.message.slice(0, 80);
  return fallback;
}
