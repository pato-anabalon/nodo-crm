"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidSlug } from "@/lib/tenant/host";

/**
 * Takes the person to their company's subdomain.
 *
 * It deliberately doesn't hit the database: telling a stranger whether a
 * subdomain exists would let them work out which companies use the platform. If
 * they get it wrong, the subdomain itself will tell them it doesn't exist.
 */
export function CompanyFinder({ rootDomain }: { rootDomain: string }) {
  const t = useTranslations("auth");
  const [slug, setSlug] = useState("");

  const clean = slug.trim().toLowerCase();
  const valid = isValidSlug(clean);

  function go() {
    if (!valid) return;
    const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
    // A full page load, not `router.push`: this leaves for another subdomain,
    // which the Next router can't reach.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${protocol}://${clean}.${rootDomain}/login`;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        go();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="slug">{t("companyAddress")}</Label>
        <div className="flex items-center rounded-md border border-input focus-within:ring-[3px] focus-within:ring-ring/50">
          <Input
            id="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="acme"
            autoComplete="organization"
            className="border-0 shadow-none focus-visible:ring-0"
          />
          <span className="shrink-0 pr-3 text-sm text-muted-foreground">.{rootDomain}</span>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!valid}>
        {t("goToCompany")}
      </Button>
    </form>
  );
}
