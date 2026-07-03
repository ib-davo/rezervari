"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

type RevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
};

export function Reveal({
  children,
  delay = 0,
  y = 20,
  once = true,
  className,
  ...props
}: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
