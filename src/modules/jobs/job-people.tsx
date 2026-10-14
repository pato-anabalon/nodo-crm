"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellOff, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/confirm-button";
import { useActionToast } from "@/lib/use-action-toast";
import { PersonAvatar, personName, type Person } from "./avatars";
import type { JobActionState } from "./actions";

export type JobPerson = Person & { roleName: string; trades: string[] };

/**
 * Who is on the job: their profile and trades beside each name, the way a site
 * manager reads a crew list. Adding and removing sit behind `jobs.members`;
 * following is each person's own choice and needs nothing.
 */
export function JobPeople({
  members,
  candidates,
  currentUserId,
  following,
  canManage,
  onAdd,
  onRemove,
  onFollow,
}: {
  members: JobPerson[];
  candidates: JobPerson[];
  currentUserId: string;
  /** Null when the viewer isn't a member (they see the job through `jobs.read.all`). */
  following: boolean | null;
  canManage: boolean;
  onAdd: (state: JobActionState, formData: FormData) => Promise<JobActionState>;
  onRemove: (userId: string) => Promise<JobActionState>;
  onFollow: (following: boolean) => Promise<JobActionState>;
}) {
  const t = useTranslations("jobs.people");
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<JobActionState>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <div className="flex flex-wrap gap-2">
          {following !== null ? (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => onFollow(!following))}>
              {following ? <BellOff className="size-4" /> : <Bell className="size-4" />}
              {following ? t("unfollow") : t("follow")}
            </Button>
          ) : null}
          {canManage ? <AddPeople candidates={candidates} onAdd={onAdd} /> : null}
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => {
          const name = personName(member);
          return (
            <li key={member.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
              <PersonAvatar person={member} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {name}
                  {member.id === currentUserId ? <span className="font-normal text-muted-foreground"> · {t("you")}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[member.roleName, ...member.trades].join(" · ")}
                </p>
              </div>
              {canManage ? (
                <ConfirmButton
                  trigger={
                    <Button variant="ghost" size="icon" className="size-7" disabled={pending} aria-label={t("remove")}>
                      <X className="size-4" />
                    </Button>
                  }
                  title={t("removeTitle", { name })}
                  description={t("removeBody")}
                  confirmLabel={t("remove")}
                  onConfirm={() => run(() => onRemove(member.id))}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AddPeople({
  candidates,
  onAdd,
}: {
  candidates: JobPerson[];
  onAdd: (state: JobActionState, formData: FormData) => Promise<JobActionState>;
}) {
  const t = useTranslations("jobs.people");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await onAdd(prev, formData);
    if (next.message) setOpen(false);
    return next;
  }, {});
  useActionToast(state);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="size-4" />
          {t("add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
          {candidates.length === 0 ? <DialogDescription>{t("nobodyLeft")}</DialogDescription> : null}
        </DialogHeader>
        {candidates.length > 0 ? (
          <form action={formAction} className="space-y-4">
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {candidates.map((person) => (
                <li key={person.id}>
                  <Label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 font-normal hover:bg-accent">
                    <Checkbox name="userId" value={person.id} />
                    <PersonAvatar person={person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{personName(person)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[person.roleName, ...person.trades].join(" · ")}
                      </span>
                    </span>
                  </Label>
                </li>
              ))}
            </ul>
            <Button type="submit" disabled={pending}>
              {pending ? tCommon("saving") : t("addSelected")}
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
