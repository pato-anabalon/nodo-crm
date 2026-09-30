"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { setCompanyActiveAction } from "./actions";
import type { CompanyRow } from "./service";

export function CompanyList({ companies }: { companies: CompanyRow[] }) {
  const t = useTranslations("platform");
  const [pending, startTransition] = useTransition();

  function toggle(company: CompanyRow) {
    startTransition(async () => {
      const result = await setCompanyActiveAction(company.id, !company.isActive);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  if (companies.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.company")}</TableHead>
            <TableHead>{t("columns.owner")}</TableHead>
            <TableHead>{t("columns.users")}</TableHead>
            <TableHead>{t("columns.createdAt")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t("columns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id}>
              <TableCell>
                <p className="font-medium">{company.name}</p>
                <a
                  href={company.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {company.slug}
                </a>
              </TableCell>
              <TableCell className="text-sm">
                {company.ownerEmail ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-sm">{company.userCount}</TableCell>
              <TableCell className="text-sm">{formatDate(company.createdAt, "en-NZ", "Pacific/Auckland")}</TableCell>
              <TableCell>
                {company.isActive ? (
                  <Badge>{t("status.active")}</Badge>
                ) : (
                  <Badge variant="destructive">{t("status.suspended")}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => toggle(company)}
                >
                  {company.isActive ? (
                    <Ban className="size-4" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  {company.isActive ? t("suspend") : t("activate")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
