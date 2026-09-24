/**
 * Company scoping logic, with no Prisma dependency.
 *
 * It lives apart from `tenant.ts` so it can be tested without opening a
 * connection: this is where it's decided whether a company may see a row, so it
 * had better be cheap to test and easy to read.
 */

/**
 * Models that carry their own `companyId`.
 *
 * Every model in the schema must be classified here, in `RELATION_TENANT_MODELS`
 * or in `GLOBAL_MODELS`. A test reads the Prisma schema and fails if one is
 * missing: forgetting to add a new model is how a company ends up seeing
 * another's rows, and it happened once already.
 */
export const DIRECT_TENANT_MODELS = new Set([
  "Activity",
  "CatalogueItem",
  "EmailTemplate",
  "QuoteEmail",
  "ReviewLink",
  "QuoteTemplate",
  "ClientCompany",
  "CompanyDocument",
  "CompanyReview",
  "Contact",
  "IngestAttempt",
  "IngestKey",
  "Invitation",
  "Lead",
  "LeadSubmission",
  "Membership",
  "Notification",
  "NotificationPreference",
  "Quote",
  "QuoteAcceptance",
  "QuoteEvent",
  "QuoteMessage",
  "QuoteShare",
  "Role",
  "Task",
]);

/** Models that inherit the company through a relation. */
export const RELATION_TENANT_MODELS: Record<string, string> = {
  QuoteItem: "quote",
  QuoteSection: "quote",
  QuoteAttachment: "quote",
  QuoteTemplateItem: "template",
  QuoteTemplateSection: "template",
  QuoteShareToken: "share",
  RolePermission: "role",
};

/**
 * Models that belong to no company on purpose.
 *
 * `Company` is the tenant itself; `User` spans companies because one person can
 * work in several; the Auth.js tables hang off the user; `Permission` is a
 * platform-wide catalogue.
 */
export const GLOBAL_MODELS = new Set([
  "Company",
  "User",
  "Permission",
  "Account",
  "Session",
  "VerificationToken",
]);

/** Operations whose `where` decides which rows are affected. */
const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * Operations whose `where` Prisma requires to contain a unique field **at the
 * top level**.
 *
 * For these the company filter has to be merged in alongside the unique field,
 * not wrapped in an `AND` — inside an `AND` the id stops counting as unique and
 * Prisma rejects the call. Prisma does accept extra non-unique fields next to
 * the unique one, which is what makes the scoping work here.
 */
const UNIQUE_WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

/** Operations that write new rows and must be handed the company. */
const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn", "upsert"]);

type AnyRecord = Record<string, unknown>;

export function tenantFilter(model: string, companyId: string): AnyRecord | null {
  if (DIRECT_TENANT_MODELS.has(model)) {
    return { companyId };
  }
  const relation = RELATION_TENANT_MODELS[model];
  if (relation) {
    return { [relation]: { is: { companyId } } };
  }
  return null;
}

/** For list-style operations: `AND` never clashes with what the caller wrote. */
function andWhere(where: unknown, filter: AnyRecord): AnyRecord {
  if (!where || typeof where !== "object" || Array.isArray(where)) return { ...filter };
  return { AND: [where as AnyRecord, filter] };
}

/** For unique-where operations: merged in, so the unique field stays on top. */
function mergeWhere(where: unknown, filter: AnyRecord): AnyRecord {
  if (!where || typeof where !== "object" || Array.isArray(where)) return { ...filter };
  // The filter goes last on purpose: a companyId sent by the caller is overwritten.
  return { ...(where as AnyRecord), ...filter };
}

function withCompanyData(data: unknown, companyId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...(row as AnyRecord), companyId }));
  }
  if (data && typeof data === "object") {
    return { ...(data as AnyRecord), companyId };
  }
  return data;
}

/** Builds the arguments already scoped to the company. */
export function applyTenantScope(
  model: string,
  operation: string,
  args: unknown,
  companyId: string,
): unknown {
  const filter = tenantFilter(model, companyId);
  if (!filter) return args;

  const nextArgs: AnyRecord = { ...((args as AnyRecord) ?? {}) };
  const isDirect = DIRECT_TENANT_MODELS.has(model);

  if (WHERE_OPERATIONS.has(operation)) {
    nextArgs.where = UNIQUE_WHERE_OPERATIONS.has(operation)
      ? mergeWhere(nextArgs.where, filter)
      : andWhere(nextArgs.where, filter);
  }

  // In models that inherit the company through a relation, the parent supplies it.
  if (isDirect && CREATE_OPERATIONS.has(operation)) {
    if (operation === "upsert") {
      nextArgs.create = withCompanyData(nextArgs.create, companyId);
    } else {
      // `createMany` takes an array; `create`, an object.
      nextArgs.data = withCompanyData(nextArgs.data, companyId);
    }
  }

  return nextArgs;
}
