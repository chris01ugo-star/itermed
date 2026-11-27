"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";

type DialogProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
};

/** True when the caller already sets this utility, so the default must not fight it. */
function declaresUtility(className: string | undefined, utility: RegExp): boolean {
  return utility.test(className ?? "");
}

const emptySubscribe = () => () => {};

export function Dialog({ open, onClose, children }: DialogProps) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] overflow-y-auto bg-[#1E324E]/45 backdrop-blur-[2px]">
      <div
        className="flex min-h-full items-center justify-center p-4 sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

type DialogContentProps = {
  children: ReactNode;
  className?: string;
};

export function DialogContent({ children, className }: DialogContentProps) {
  const ownsWidth = declaresUtility(className, /(?:^|\s)(?:[\w-]+:)*max-w-/);
  const ownsPadding = declaresUtility(className, /(?:^|\s)(?:[\w-]+:)*p(?:x|y|t|r|b|l|s|e)?-/);
  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => event.stopPropagation()}
      className={cn(
        "my-auto w-full max-h-[min(90dvh,720px)] overflow-y-auto rounded-2xl border border-white/20 bg-white shadow-[0_28px_80px_rgba(30,50,78,0.28)]",
        !ownsWidth && "max-w-[42rem]",
        !ownsPadding && "p-5 sm:p-6",
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
