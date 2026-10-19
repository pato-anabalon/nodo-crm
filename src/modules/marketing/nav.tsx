"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import type { NavCopy } from "./copy";

const LINKS = [
  ["#enquiries", "enquiries"],
  ["#quotes", "quotes"],
  ["#jobs", "jobs"],
  // ["#founders", "team"] comes back with the founders section (`SHOW_FOUNDERS` in the page).
] as const;

/** The section the bar arrives with: everything above it is the hero. */
const FIRST_SECTION = "enquiries";
/** How close to the top that section has to come: a link lands it at 0, a hand on the wheel rarely does. */
const ARRIVE_PX = 48;

/** The phone menu stays open over the page it just scrolled to unless it is told otherwise. */
const closeMenu = (event: React.MouseEvent<HTMLElement>) => event.currentTarget.closest("details")?.removeAttribute("open");

/**
 * The bar, once the hero is behind you. The hero already carries the wordmark's
 * whole pitch and both of its actions, so a bar over it only said the same
 * thing twice — and its glass pills had a cloud drifting behind them. It slides
 * in as the first section reaches the top, and goes again on the way back up.
 *
 * Solid rather than glass: below the hero it crosses white sections and dark
 * ones, and has to read over both. On a phone the links fold into a menu that
 * works without script (`<details>`).
 */
export function Nav({ copy }: { copy: NavCopy }) {
  const [shown, setShown] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", () => {
    const top = document.getElementById(FIRST_SECTION)?.getBoundingClientRect().top;
    setShown(top !== undefined && top <= ARRIVE_PX);
  });

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-6"
      initial={false}
      animate={shown ? { y: 0, opacity: 1 } : { y: "-110%", opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      // Out of sight is out of reach: no tabbing into a bar nobody can see.
      inert={!shown}
      aria-hidden={!shown}
    >
      <nav
        aria-label={copy.label}
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl bg-white/90 py-2 pl-5 pr-2 shadow-lg shadow-zinc-950/10 ring-1 ring-zinc-950/10 backdrop-blur-md"
      >
        <Link href="/" className="text-xl font-semibold tracking-tight text-zinc-950">
          Nodo CRM
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(([href, key]) => (
            <a
              key={key}
              href={href}
              className="rounded-lg px-3.5 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
            >
              {copy[key]}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/sign-in"
            className="rounded-xl px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
          >
            {copy.signIn}
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-[#1a4be0] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1640c4] active:scale-[0.98]"
          >
            {copy.createCompany}
          </Link>
        </div>

        <details className="group relative md:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-950/10 [&::-webkit-details-marker]:hidden">
            <Menu className="size-4" aria-hidden />
            {copy.menu}
          </summary>
          <div className="absolute right-0 mt-2 grid w-56 gap-1 rounded-2xl bg-white p-2 text-sm text-zinc-900 shadow-xl ring-1 ring-zinc-950/10">
            {LINKS.map(([href, key]) => (
              <a key={key} href={href} onClick={closeMenu} className="rounded-lg px-3 py-2 hover:bg-zinc-100">
                {copy[key]}
              </a>
            ))}
            <Link href="/sign-in" className="rounded-lg px-3 py-2 hover:bg-zinc-100">
              {copy.signIn}
            </Link>
            <Link href="/register" className="rounded-lg bg-[#1a4be0] px-3 py-2 font-medium text-white">
              {copy.createCompany}
            </Link>
          </div>
        </details>
      </nav>
    </motion.header>
  );
}
