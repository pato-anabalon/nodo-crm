"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { requireJobContext } from "./access";
import { deleteStored, storedFilesOfJob } from "./files-service";
import { jobDatesSchema, jobFormSchema, jobStatusSchema, tradeNameSchema } from "./schemas";
import {
  addJobMembers,
  createJob,
  createTrade,
  deleteJob,
  deleteTrade,
  removeJobMember,
  setFollowing,
  setJobDates,
  setJobStatus,
  setMemberTrades,
  startJobFromQuote,
  updateJob,
} from "./service";

export type JobActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function refresh(jobId?: string) {
  revalidatePath("/jobs");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

/**
 * "Start job" on an accepted quote. On success it goes straight to the job —
 * that is where the next thing anybody does happens.
 */
export async function startJobAction(quoteId: string): Promise<JobActionState> {
  const ctx = await requirePermission("jobs.create");
  const t = await getTranslations("jobs");

  const outcome = await startJobFromQuote(ctx, quoteId);
  if (!outcome.ok) {
    if (outcome.reason === "already-started" && outcome.jobId) redirect(`/jobs/${outcome.jobId}`);
    return { error: t(`startErrors.${outcome.reason}`) };
  }

  revalidatePath(`/quotes/${quoteId}`);
  refresh();
  redirect(`/jobs/${outcome.jobId}`);
}

export async function createJobAction(_prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const ctx = await requirePermission("jobs.create");
  const t = await getTranslations();

  const details = jobFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    address: formData.get("address"),
  });
  const dates = jobDatesSchema.safeParse({ startsOn: formData.get("startsOn"), endsOn: formData.get("endsOn") });
  if (!details.success || !dates.success) {
    return {
      fieldErrors: translateFieldErrors(
        {
          ...(details.success ? {} : details.error.flatten().fieldErrors),
          ...(dates.success ? {} : dates.error.flatten().fieldErrors),
        },
        t,
      ),
    };
  }

  const jobId = await createJob(ctx, { ...details.data, ...dates.data });
  refresh();
  redirect(`/jobs/${jobId}`);
}

export async function updateJobAction(
  jobId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "jobs.update");
  const t = await getTranslations();

  const parsed = jobFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    address: formData.get("address"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await updateJob(ctx, jobId, parsed.data);
  refresh(jobId);
  return { message: t("jobs.saved") };
}

/**
 * The job's dates are their own action behind their own permission: a profile
 * that may fix the job's name may not necessarily move its plan.
 */
export async function setJobDatesAction(
  jobId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "jobs.dates");
  const t = await getTranslations();

  const parsed = jobDatesSchema.safeParse({ startsOn: formData.get("startsOn"), endsOn: formData.get("endsOn") });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await setJobDates(ctx, jobId, parsed.data);
  refresh(jobId);
  return { message: t("jobs.datesSaved") };
}

export async function setJobStatusAction(
  jobId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "jobs.update");
  const t = await getTranslations("jobs");

  const parsed = jobStatusSchema.safeParse(formData.get("status"));
  if (!parsed.success) return { error: t("invalidStatus") };

  await setJobStatus(ctx, jobId, parsed.data);
  refresh(jobId);
  return { message: t("statusSaved") };
}

export async function deleteJobAction(jobId: string): Promise<void> {
  const { ctx } = await requireJobContext(jobId, "jobs.delete");
  // Read before the rows cascade away, cleared from the store after.
  const stored = await storedFilesOfJob(ctx, jobId);
  await deleteJob(ctx, jobId);
  await deleteStored(stored);
  refresh();
  redirect("/jobs");
}

export async function addJobMembersAction(
  jobId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "jobs.members");
  const t = await getTranslations("jobs.people");

  const userIds = formData.getAll("userId").filter((v): v is string => typeof v === "string" && v !== "");
  if (userIds.length === 0) return { error: t("pickSomebody") };

  const added = await addJobMembers(ctx, jobId, userIds);
  refresh(jobId);
  return { message: t("added", { count: added.length }) };
}

export async function removeJobMemberAction(jobId: string, userId: string): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "jobs.members");
  const t = await getTranslations("jobs.people");

  await removeJobMember(ctx, jobId, userId);
  refresh(jobId);
  return { message: t("removed") };
}

/** Following is each person's own choice about their own notices. */
export async function setFollowingAction(jobId: string, following: boolean): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId);
  const t = await getTranslations("jobs.people");

  await setFollowing(ctx, jobId, following);
  refresh(jobId);
  return { message: following ? t("following") : t("notFollowing") };
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

export async function createTradeAction(_prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = tradeNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors({ name: parsed.error.issues.map((i) => i.message) }, t) };
  }

  const outcome = await createTrade(ctx, parsed.data);
  if (!outcome.ok) return { fieldErrors: { name: [t("trades.duplicate")] } };

  revalidatePath("/settings/trades");
  return { message: t("trades.added") };
}

export async function deleteTradeAction(id: string): Promise<JobActionState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("trades");

  await deleteTrade(ctx, id);
  revalidatePath("/settings/trades");
  revalidatePath("/settings/team");
  return { message: t("deleted") };
}

/** A person's trades go with who they are at this company, so they need `users.update`. */
export async function setMemberTradesAction(
  userId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const ctx = await requirePermission("users.update");
  const t = await getTranslations("trades");

  const tradeIds = formData.getAll("tradeId").filter((v): v is string => typeof v === "string");
  await setMemberTrades(ctx, userId, tradeIds);
  revalidatePath("/settings/team");
  return { message: t("memberSaved") };
}
