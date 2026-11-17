import { notFound } from "next/navigation";
import { BrandTheme } from "@/components/brand-theme";
import { getCompanyBySlug } from "@/lib/tenant/company";

/**
 * Layout for a company subdomain. It only resolves the brand; access control
 * lives in the (app) layout, because login and `no-access` hang off here and
 * have to be public.
 */
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);

  if (!company) notFound();

  return (
    <>
      <BrandTheme primaryColor={company.primaryColor} accentColor={company.accentColor} />
      {children}
    </>
  );
}
