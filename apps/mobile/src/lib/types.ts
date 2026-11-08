/**
 * The responses the app reads, as `/api/m/v1` sends them: instants as ISO,
 * days as `YYYY-MM-DD`, notices as kind and parameters. Written by hand from
 * the routes for now; `packages/api-contract` replaces them once a second
 * consumer needs the same shapes.
 */

export type CompanyChoice = { slug: string; name: string; logoUrl: string | null; primaryColor: string };

export type SignInResult =
  | { kind: "session"; token: string; expiresAt: string; companies: CompanyChoice[] }
  | { kind: "code"; challengeId: string; email: string; expiresAt: string };

export type Me = {
  user: { id: string; name: string | null; email: string; image: string | null };
  company: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
    currency: string;
    formatLocale: string;
    timezone: string;
  };
  role: { id: string; key: string | null; name: string | null };
  locale: "en-GB" | "es";
  permissions: string[];
};

export type JobStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";

export type JobSummary = {
  id: string;
  name: string;
  description: string | null;
  status: JobStatus;
  startsOn: string | null;
  endsOn: string | null;
  members: { id: string; name: string | null; image: string | null }[];
};

export type JobList = { page: number; pageCount: number; jobs: JobSummary[] };

export type Notice = {
  id: string;
  kind: string;
  params: Record<string, string | number>;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type Inbox = { unread: number; items: Notice[] };
