"use client";

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

type DialogProps = {
  open: boolean;
  children: ReactNode;
};

export function Dialog({ open, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60" role="presentation">
      <div className="flex min-h-full justify-center p-4 sm:p-6">
        <div className="pointer-events-none relative z-10 m-auto flex w-full max-w-lg justify-center sm:max-w-xl md:max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}

type DialogContentProps = {
  children: ReactNode;
  className?: string;
};

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "pointer-events-auto w-full max-h-[min(90dvh,720px)] overflow-y-auto rounded-xl border border-border bg-panel-bg p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

type DialogHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return <div className={cn("mb-4 space-y-1.5", className)}>{children}</div>;
}

type DialogTitleProps = {
  children: ReactNode;
  className?: string;
};

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2 className={cn("font-display text-base font-semibold tracking-tight text-brand-primary", className)}>
      {children}
    </h2>
  );
}

type DialogDescriptionProps = {
  children: ReactNode;
  className?: string;
};

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <div className={cn("text-xs leading-relaxed text-slate-600", className)}>{children}</div>
  );
}

type DialogFooterProps = {
  children: ReactNode;
  className?: string;
};

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={cn("mt-6 flex items-center justify-end gap-3", className)}>{children}</div>
  );
}
