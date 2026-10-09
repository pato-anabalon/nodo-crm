import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyLogo } from "@/components/company-logo";
import { acceptInvitation, hasExistingPassword, resolveInvitation } from "@/modules/team/service";
import { acceptWithPassword } from "./actions";
import { JoinPasswordForm } from "./join-password-form";

/**
 * Where an invitation is accepted.
 *
 * Outside the authenticated area on purpose: whoever opens this has no
 * membership in the company yet, so the token is the only thing vouching for
 * them — the same shape as the customer's quote link.
 *
 * Accepting happens on a POST and never on the GET. A link that changed
 * something just by being fetched would be joined by the first mail scanner
 * that previewed it.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [{ state, invitation }, session, t, tRoles] = await Promise.all([
    resolveInvitation(token),
    auth(),
    getTranslations("team.join"),
    getTranslations("roles"),
  ]);

  if (state !== "ok" || !invitation) {
    return <Notice title={t("invalidTitle")} body={t(`invalid.${state}`)} />;
  }

  const user = session?.user;

  if (!user?.email) {
    // The token already proves they hold the invited address, so this sets
    // up the account directly rather than sending them off for a magic-link
    // round trip — see the comment on `acceptInvitationWithPassword`.
    const hasPassword = await hasExistingPassword(invitation.email);
    return (
      <JoinPasswordForm
        company={{ name: invitation.company.name, logoUrl: invitation.company.logoUrl }}
        email={invitation.email}
        role={tRoles(`${invitation.role.key}.name`)}
        hasPassword={hasPassword}
        accept={acceptWithPassword.bind(null, token)}
      />
    );
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <Notice
        title={t("wrongAccountTitle")}
        body={t("wrongAccountBody", { invited: invitation.email, current: user.email })}
      />
    );
  }

  async function accept() {
    "use server";
    const current = await auth();
    if (!current?.user?.id || !current.user.email) return;

    const result = await acceptInvitation(token, {
      id: current.user.id,
      email: current.user.email,
    });
    if (result.ok) redirect("/");
  }

  return (
    <Notice
      title={t("title", { company: invitation.company.name })}
      body={t("body", { role: tRoles(`${invitation.role.key}.name`) })}
      logo={{ name: invitation.company.name, url: invitation.company.logoUrl }}
      form={{ action: accept, label: t("accept") }}
    />
  );
}

function Notice({
  title,
  body,
  logo,
  form,
}: {
  title: string;
  body: string;
  logo?: { name: string; url: string | null };
  form?: { action: () => Promise<void>; label: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          {logo ? (
            <div className="flex justify-center">
              <CompanyLogo name={logo.name} logoUrl={logo.url} size="lg" />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>

          {form ? (
            <form action={form.action}>
              <Button type="submit" className="w-full">
                {form.label}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
