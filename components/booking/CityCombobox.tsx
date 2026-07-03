"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function CityCombobox({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Filtru pe primele litere (startsWith). Dacă valoarea e exact o opțiune,
  // arătăm întreaga listă — altfel după select dropdown-ul ar conține doar
  // selecția curentă.
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    if (options.some((o) => o.toLowerCase() === q)) return options;
    return options.filter((o) => o.toLowerCase().startsWith(q));
  }, [value, options]);

  const select = (o: string) => {
    onChange(o);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        autoComplete="off"
        className={cn(
          "w-full bg-transparent text-[0.95rem] font-semibold text-[color:var(--navy-900)] outline-none placeholder:text-[color:var(--ink-400)] placeholder:font-medium",
          className
        )}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-[color:var(--ink-200)] bg-white py-1 shadow-[0_18px_40px_-20px_rgba(20,58,122,0.45)]"
        >
          {filtered.map((o) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              onMouseDown={(e) => {
                // preventDefault păstrează focus pe input — altfel blur-ul
                // declanșează click-outside și se închide înainte de select.
                e.preventDefault();
                select(o);
              }}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm transition-colors",
                o === value
                  ? "bg-[color:var(--navy-50)] font-semibold text-[color:var(--navy-900)]"
                  : "text-[color:var(--ink-700)] hover:bg-[color:var(--navy-50)] hover:text-[color:var(--navy-900)]"
              )}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
