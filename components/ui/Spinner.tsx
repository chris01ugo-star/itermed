import { cn } from "@/app/utils/cn";

type SpinnerProps = {
  className?: string;
  size?: number;
};

/** Inline loading indicator for buttons and overlays. */
export function Spinner({ className, size = 16 }: SpinnerProps) {
  return (
    <svg
      className={cn("animate-spin", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v2.6A5.4 5.4 0 006.6 12H4z"
      />
    </svg>
  );
}
