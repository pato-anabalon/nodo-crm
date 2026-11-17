"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { slugify } from "@/lib/tenant/slug";
import { ROOT_DOMAIN } from "@/lib/tenant/host";
import type { RowsCopy } from "../copy";
import { Reveal } from "../reveal";

/** The colours on offer: a handful a company might well pick, all dark enough to carry white text. */
const SWATCHES = ["#1a4be0", "#e2364b", "#1f8a5b", "#d9601c", "#7c3aed", "#0f172a"] as const;

/** Up to two initials, the way `CompanyLogo` falls back when there is no logo. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

/**
 * Type a company's name, pick a colour, and a quote beside it takes both: its
 * subdomain, its initials for a logo, its colour on the button. The name is
 * carried on to sign-up, so what was typed here is already filled in there.
 */
export function BrandDemo({ copy, flip = false }: { copy: RowsCopy["brand"]; flip?: boolean }) {
  const id = useId();
  const [name, setName] = useState("");
  const [colour, setColour] = useState<string>(SWATCHES[0]);
  const company = name.trim() || copy.namePlaceholder;
  const slug = slugify(company) || "yourcompany";
  const signUp = name.trim() ? `/register?company=${encodeURIComponent(name.trim())}` : "/register";

  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
      <Reveal className={flip ? "md:order-2" : ""}>
        <h3 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-zinc-950 md:text-4xl">{copy.title}</h3>
        <p className="mt-4 max-w-md text-pretty text-lg text-zinc-600">{copy.body}</p>

        <label htmlFor={`${id}name`} className="mt-8 block text-sm font-medium text-zinc-900">
          {copy.nameLabel}
        </label>
        <input
          id={`${id}name`}
          value={name}
          maxLength={40}
          autoComplete="organization"
          onChange={(event) => setName(event.target.value)}
          placeholder={copy.namePlaceholder}
          className="mt-2 w-full max-w-sm rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
        />

        <p id={`${id}colour`} className="mt-6 text-sm font-medium text-zinc-900">
          {copy.colourLabel}
        </p>
        <div role="radiogroup" aria-labelledby={`${id}colour`} className="mt-2 flex gap-2.5">
          {SWATCHES.map((swatch, index) => (
            <button
              key={swatch}
              type="button"
              role="radio"
              aria-checked={colour === swatch}
              aria-label={`${copy.colourLabel} ${index + 1}`}
              onClick={() => setColour(swatch)}
              style={{ background: swatch }}
              className="size-9 rounded-full ring-offset-2 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 aria-checked:ring-2 aria-checked:ring-zinc-950"
            />
          ))}
        </div>

        <Link
          href={signUp}
          style={{ background: colour }}
          className="mt-8 inline-block rounded-xl px-5 py-3.5 font-medium text-white shadow-sm transition-[background-color,transform] duration-300 active:scale-[0.98]"
        >
          {copy.cta}
        </Link>
      </Reveal>

      <Reveal delay={0.1} className={flip ? "md:order-1" : ""}>
        {/* A browser window on the customer's side: the company's own address, then its quote. */}
        <div
          className="overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(10,20,40,0.35)] ring-1 ring-zinc-950/10"
          aria-hidden
        >
          <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <span className="flex gap-1.5">
              {["#ff5f57", "#febc2e", "#28c840"].map((dot) => (
                <span key={dot} className="size-2.5 rounded-full" style={{ background: dot }} />
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-xs text-zinc-600 ring-1 ring-zinc-200">
              <span className="font-medium text-zinc-950">{slug}</span>.{ROOT_DOMAIN}/q/…
            </span>
          </div>

          <div className="h-1.5 transition-colors duration-300" style={{ background: colour }} />
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white transition-colors duration-300"
                style={{ background: colour }}
              >
                {initials(company) || "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-950">{company}</p>
                <p className="text-xs text-zinc-500">COT-000123</p>
              </div>
            </div>

            <p className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">{copy.quoteTitle}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
              {copy.from} <span className="text-zinc-800">{company}</span>
            </p>

            <dl className="mt-5 divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
              {[
                [copy.lineA, "$6,320.00"],
                [copy.lineB, "$12,655.00"],
              ].map(([line, amount]) => (
                <div key={line} className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-zinc-700">{line}</dt>
                  <dd className="tabular-nums text-zinc-950">{amount}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 px-4 py-3 text-sm font-semibold">
                <dt className="text-zinc-950">{copy.total}</dt>
                <dd className="tabular-nums text-zinc-950">$18,975.00</dd>
              </div>
            </dl>

            <span
              className="mt-6 block rounded-xl py-3 text-center text-sm font-medium text-white transition-colors duration-300"
              style={{ background: colour }}
            >
              {copy.accept}
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
