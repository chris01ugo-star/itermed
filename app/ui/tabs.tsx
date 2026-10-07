"use client";

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

type TabsContextProps = {
  value: string;
  onValueChange: (value: string) => void;
};

type TabsRootProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
};

export function Tabs({ value, onValueChange, children, className }: TabsRootProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)} data-tabs-value={value}>
      {children}
    </div>
  );
}

type TabsListProps = {
  children: ReactNode;
  className?: string;
  value?: string;
  /**
   * Allow tabs to wrap onto multiple rows instead of scrolling/overflowing.
   * Uses a softer corner radius that stays correct regardless of row count
   * (a full pill radius looks broken once the list wraps to 2+ rows).
   */
  wrap?: boolean;
};

export function TabsList({ children, className, wrap = false }: TabsListProps) {
  return (
    <div
      className={cn(
        wrap
          ? "flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1"
          : "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

type TabsTriggerProps = {
  value: string;
  currentValue: string;
  onSelect: (value: string) => void;
  children: ReactNode;
  className?: string;
  "data-tour"?: string;
};

export function TabsTrigger({
  value,
  currentValue,
  onSelect,
  children,
  className,
  "data-tour": dataTour,
}: TabsTriggerProps) {
  const isActive = value === currentValue;
  return (
    <button
      type="button"
      data-tour={dataTour}
      onClick={() => onSelect(value)}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
        isActive
          ? "bg-[#1E324E] text-white shadow-sm"
          : "bg-transparent text-slate-500 hover:text-[#2F4156]",
        className,
      )}
    >
      {children}
    </button>
  );
}

type TabsContentProps = {
  value: string;
  currentValue: string;
  children: ReactNode;
  className?: string;
};

export function TabsContent({
  value,
  currentValue,
  children,
  className,
}: TabsContentProps) {
  if (value !== currentValue) return null;
  return (
    <div className={className}>
      {children}
    </div>
  );
}

