import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JobForm } from "@/modules/jobs/job-form";
import { createJobAction } from "@/modules/jobs/actions";

export async function generateMetadata() {
  const t = await getTranslations("jobs");
  return { title: t("new") };
}

export default async function NewJobPage() {
  await requirePermission("jobs.create");
  const t = await getTranslations("jobs");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/jobs" aria-label={t("backToJobs")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("new")}</h1>
          <p className="text-sm text-muted-foreground">{t("newSubtitle")}</p>
        </div>
      </div>

      <Card>
        <CardContent>
          <JobForm action={createJobAction} withDates submitLabel={t("create")} pendingLabel={t("creating")} />
        </CardContent>
      </Card>
    </div>
  );
}
