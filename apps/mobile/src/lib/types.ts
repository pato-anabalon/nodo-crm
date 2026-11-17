import type { ChatSegment } from "@nodo/core/jobs/chat/text";

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

export type Person = { id: string; name: string | null; email: string; image: string | null };

export type JobDetail = {
  job: {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    status: JobStatus;
    closed: boolean;
    closedAt: string | null;
    closedBy: { name: string | null; email: string } | null;
    startsOn: string | null;
    endsOn: string | null;
    color: string | null;
    quote: { id: string; reference: string } | null;
    members: (Person & { following: boolean })[];
  };
  /** What this person may do on this job; a finished job's writes are already off. */
  permissions: string[];
};

export type ActivityRow = {
  id: string;
  type: string;
  params: Record<string, unknown> | null;
  createdAt: string;
  actor: Person | null;
  thumbnails: string[];
};

export type TodoRow = {
  id: string;
  listId: string;
  title: string;
  position: number;
  hasNotes: boolean;
  startsOn: string | null;
  dueOn: string | null;
  done: boolean;
  completedAt: string | null;
  overdue: boolean;
  assignees: Person[];
  comments: number;
  files: number;
};

export type TodoList = {
  id: string;
  name: string;
  description: string | null;
  comments: number;
  open: TodoRow[];
  done: TodoRow[];
};

export type JobFile = {
  id: string;
  name: string;
  url: string;
  contentType: string;
  kind: string;
  size: number;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  createdAt: string;
};

export type Comment = {
  id: string;
  body: string;
  author: Person | null;
  createdAt: string;
  editedAt: string | null;
  files: JobFile[];
  canUpdate: boolean;
  canDelete: boolean;
};

export type TodoDetail = {
  id: string;
  jobId: string;
  list: { id: string; name: string };
  title: string;
  notes: string | null;
  startsOn: string | null;
  dueOn: string | null;
  done: boolean;
  completedAt: string | null;
  completedBy: Person | null;
  overdue: boolean;
  createdAt: string;
  createdBy: Person | null;
  assignees: Person[];
  files: JobFile[];
  comments: Comment[];
};

export type ChatMessage = {
  id: string;
  author: Person | null;
  /** The text already cut into plain words, links and mentions, against the people stored on it. */
  segments: ChatSegment[];
  files: JobFile[];
  createdAt: string;
  canDelete: boolean;
  /** Sent from this phone and not yet confirmed. */
  pending?: true;
};

export type ChatPage = { hasEarlier: boolean; messages: ChatMessage[] };

export type Folder = { id: string; name: string; fileCount: number; folderCount: number; updatedAt: string };

export type FolderContents = {
  trail: { id: string; name: string }[];
  folders: Folder[];
  files: (JobFile & { uploadedBy: Person | null })[];
};

export type ScheduleEvent = {
  id: string;
  title: string;
  allDay: boolean;
  milestone: boolean;
  /** The days it covers on the company's calendar; a timed one also has its instants. */
  startsOn: string;
  endsOn: string;
  startsAt: string | null;
  endsAt: string | null;
  participants: Person[];
  comments: number;
};

export type TodoDue = { id: string; title: string; dueOn: string };

export type Schedule = { from: string; to: string; events: ScheduleEvent[]; todosDue: TodoDue[] };

/** A standard category carries its `key` and no name, and is translated; the company's own has a name. */
export type PostCategory = { id: string; key: string | null; name: string | null; emoji: string };

export type PostSummary = {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  author: Person | null;
  category: PostCategory | null;
  commentCount: number;
  fileCount: number;
};

export type Board = { categories: PostCategory[]; categoryId: string | null; posts: PostSummary[] };

export type Post = {
  id: string;
  jobId: string;
  title: string;
  body: string;
  publishedAt: string;
  editedAt: string | null;
  author: Person | null;
  category: PostCategory | null;
  files: JobFile[];
  comments: Comment[];
};
