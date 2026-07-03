"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function PageHero({
  eyebrow,
  title,
  description,
  children,
  tone = "light",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  tone?: "light" | "dark";
}) {
  if (tone === "dark") {
    return (
      <section className="relative overflow-hidden bg-hero-navy text-white">
        <div className="bg-noise absolute inset-0 opacity-30" />
        <div className="container-page relative py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl"
          >
            {eyebrow && (
              <span className="eyebrow text-[color:var(--red-400)]">
                <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
                {eyebrow}
              </span>
            )}
            <h1 className="display-hero display-xl text-white mt-5">{title}</h1>
            {description && (
              <p className="mt-6 text-lg text-white/70 max-w-2xl leading-relaxed">{description}</p>
            )}
            {children && <div className="mt-8">{children}</div>}
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative pt-12 lg:pt-20 pb-10">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="max-w-3xl"
        >
          {eyebrow && (
            <span className="eyebrow">
              <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
              {eyebrow}
            </span>
          )}
          <h1 className="display-hero display-xl text-[color:var(--navy-900)] mt-5">{title}</h1>
          {description && (
            <p className="mt-6 text-lg text-[color:var(--ink-700)] max-w-2xl leading-relaxed">{description}</p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </motion.div>
      </div>
    </section>
  );
}
