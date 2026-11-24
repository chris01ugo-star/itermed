"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";

type DialogProps = {
  open: boolean;
  children: ReactNode;
};

const emptySubscribe = () => () => {};

export function Dialog({ open, children }: DialogProps) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-[#1E324E]/50 p-4 backdrop-blur-[3px]"
      role="presentation"
    >
      <div className="w-full max-w-[42rem]">{children}</div>
    </div>,
    document.body,
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
        "w-full max-h-[min(90dvh,720px)] overflow-y-auto rounded-2xl border border-white/20 bg-white p-5 shadow-[0_28px_80px_rgba(30,50,78,0.28)] sm:p-6",
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
    <h2 className={cn("font-display text-lg font-semibold tracking-tight text-[#1E324E]", className)}>
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
    <div className={cn("text-sm leading-relaxed text-slate-600", className)}>{children}</div>
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
