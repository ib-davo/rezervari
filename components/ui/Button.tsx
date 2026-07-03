"use client";

import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { forwardRef, type ReactNode } from "react";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: "primary" | "navy" | "outline" | "ghost" | "soft" | "secondary";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary:
        "bg-[color:var(--red-500)] text-white hover:bg-[color:var(--red-600)] shadow-[0_12px_30px_-10px_rgba(225,30,43,0.55)]",
      navy:
        "bg-[color:var(--navy-900)] text-white hover:bg-[color:var(--navy-800)] shadow-[0_12px_30px_-12px_rgba(11,38,83,0.55)]",
      outline:
        "border-2 border-[color:var(--navy-900)] text-[color:var(--navy-900)] hover:bg-[color:var(--navy-50)]",
      ghost:
        "text-[color:var(--navy-900)] hover:bg-[color:var(--navy-50)]",
      soft:
        "bg-white text-[color:var(--navy-900)] border border-[color:var(--ink-200)] hover:border-[color:var(--navy-700)]",
      secondary:
        "bg-[color:var(--navy-900)] text-white hover:bg-[color:var(--navy-800)]",
    };

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-[0.95rem]",
      lg: "px-8 py-4 text-base",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-wide transition-colors duration-200",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--red-500)] focus-visible:ring-offset-2",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export { Button };
