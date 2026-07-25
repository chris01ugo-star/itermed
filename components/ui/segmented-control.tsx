"use client";

import { cn } from "@/app/utils/cn";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  /** When false, the control sizes itself to its content instead of stretching to fill its parent. Default: true. */
  fullWidth?: boolean;
  "aria-label"?: string;
};

/** Widget fisico piatto per selezione privacy / opzioni discrete. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  className,
  fullWidth = true,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-stretch rounded-full border border-slate-200 bg-slate-50 p-1",
        fullWidth && "w-full",
        disabled && "opacity-60 pointer-events-none",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium leading-none transition-colors",
              fullWidth && "flex-1",
              active
                ? "bg-[#1E324E] text-white shadow-sm"
                : "text-slate-600 hover:text-[#1E324E]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
