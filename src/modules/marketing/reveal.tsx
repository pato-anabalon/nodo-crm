"use client";

import { motion } from "motion/react";

/**
 * Rises into place once, as it enters the viewport. The text is in the HTML
 * from the first byte, for search and for screen readers, though it stays
 * transparent until the page hydrates; `MotionConfig reducedMotion="user"`
 * drops the travel and keeps only the fade.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "p" | "h2";
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Tag>
  );
}
