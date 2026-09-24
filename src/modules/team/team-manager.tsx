"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MembershipStatus, RoleKey } from "@/generated/prisma/enums";
import {
  changeMemberRoleAction,
  inviteMemberAction,
  reactivateMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  suspendMemberAction,
  type TeamState,
} from "./actions";

export type MemberRow = {
  userId: string;
  name: string | null;
  email: string;
  roleKey: RoleKey;
  status: MembershipStatus;
  isSelf: boolean;
};

export type InvitationRow = {
  id: string;
  email: string;
  roleKey: RoleKey;
  expiresLabel: string;
  expired: boolean;
};

/**
 * The company's people.
 *
 * Which buttons a row offers is decided here only to keep the screen honest;
 * what actually protects the company are the rules on the server, which is also
 * where "you can't do that to yourself" and "somebody has to stay an owner" are
 * enforced.
 */
export function TeamManager({
  members,
  invitations,
  roles,
  canInvite,
  canUpdate,
  canRemove,
}: {
  members: MemberRow[];
  invitations: InvitationRow[];
  roles: RoleKey[];
  canInvite: boolean;
  canUpdate: boolean;
  canRemove: boolean;
}) {
  const t = useTranslations("team");
  const tRoles = useTranslations("roles");
  const [state, formAction, inviting] = useActionState<TeamState, FormData>(
    inviteMemberAction,
    {},
  );
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  function run(fn: () => Promise<TeamState>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <div className="space-y-6">
      {canInvite ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("invite.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("invite.subtitle")}</p>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="email">{t("invite.email")}</Label>
                <Input id="email" name="email" type="email" required />
                {state.fieldErrors?.email ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleKey">{t("invite.role")}</Label>
                <NativeSelect
                  id="roleKey"
                  name="roleKey"
                  defaultValue={RoleKey.SALES}
                  options={roles.map((key) => ({ value: key, label: tRoles(`${key}.name`) }))}
                />
              </div>

              <Button type="submit" disabled={inviting || pending}>
                {inviting ? t("invite.sending") : t("invite.send")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("members")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.person")}</TableHead>
                  <TableHead>{t("columns.role")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead className="text-right">
                    {/* Named for screen readers, blank for everyone else: the
                        buttons below say what they do. */}
                    <span className="sr-only">{t("columns.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const suspended = member.status === MembershipStatus.SUSPENDED;
                  // Their own row stays read-only: the server refuses it anyway,
                  // and offering a button that always fails is a worse screen.
                  const editable = canUpdate && !member.isSelf;

                  return (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <p className="font-medium">{member.name ?? member.email}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </TableCell>

                      <TableCell>
                        {editable ? (
                          <NativeSelect
                            value={member.roleKey}
                            disabled={pending}
                            onChange={(event) =>
                              run(() => changeMemberRoleAction(member.userId, event.target.value))
                            }
                            className="h-8 w-auto px-2"
                            options={roles.map((key) => ({
                              value: key,
                              label: tRoles(`${key}.name`),
                            }))}
                          />
                        ) : (
                          <span className="text-sm">{tRoles(`${member.roleKey}.name`)}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant={suspended ? "secondary" : "outline"}>
                          {t(`status.${member.status}`)}
                        </Badge>
                        {member.isSelf ? (
                          <span className="ml-2 text-xs text-muted-foreground">{t("you")}</span>
                        ) : null}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {editable ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() =>
                                run(() =>
                                  suspended
                                    ? reactivateMemberAction(member.userId)
                                    : suspendMemberAction(member.userId),
                                )
                              }
                            >
                              {suspended ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
                              {suspended ? t("reactivate") : t("suspend")}
                            </Button>
                          ) : null}

                          {canRemove && !member.isSelf ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => run(() => removeMemberAction(member.userId))}
                            >
                              <Trash2 className="size-4" />
                              {t("remove")}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("pending")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("pendingHint")}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {tRoles(`${invitation.roleKey}.name`)}
                    {" · "}
                    {invitation.expired
                      ? t("invitationExpired")
                      : t("invitationExpires", { date: invitation.expiresLabel })}
                  </p>
                </div>

                {canInvite ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => revokeInvitationAction(invitation.id))}
                  >
                    {t("revokeInvitation")}
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
