import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

type CardHeaderProps = HTMLAttributes<HTMLDivElement>;
type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;
type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;
type CardContentProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("px-5 pt-4 pb-2 flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h2
      className={cn("text-sm font-semibold tracking-tight text-[#2F4156]", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn("text-xs text-slate-500", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardContentProps) {
  return (
    <div
      className={cn("px-5 pb-4 pt-1", className)}
      {...props}
    />
  );
}

