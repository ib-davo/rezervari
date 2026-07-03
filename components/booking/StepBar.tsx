"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function StepBar({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="relative rounded-2xl border border-[color:var(--ink-200)] bg-white p-3 md:p-4">
      <div className="relative flex items-center overflow-x-auto gap-2 md:gap-3">
        {steps.map((label, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <div key={label} className="flex items-center gap-2 flex-1 min-w-fit">
              <button
                type="button"
                onClick={() => onStepClick && i <= current && onStepClick(i)}
                className={cn(
                  "group flex items-center gap-2.5 flex-1 min-w-0 rounded-xl px-3 py-2 transition-all",
                  isActive
                    ? "bg-[color:var(--navy-900)] text-white"
                    : isDone
                    ? "text-[color:var(--navy-900)] hover:bg-[color:var(--navy-50)]"
                    : "text-[color:var(--ink-400)]",
                  i > current && "cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0",
                    isDone && "bg-[color:var(--success)] text-white",
                    isActive && "bg-[color:var(--red-500)] text-white",
                    !isDone && !isActive && "bg-[color:var(--ink-100)] text-[color:var(--ink-400)]"
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-xs md:text-sm font-semibold uppercase tracking-wider whitespace-nowrap",
                    isActive && "text-white"
                  )}
                >
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div className="hidden md:block h-[2px] w-8 rounded-full bg-[color:var(--ink-200)] relative overflow-hidden">
                  {isDone && (
                    <motion.div
                      layoutId={`bar-${i}`}
                      className="absolute inset-0 bg-[color:var(--success)]"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
