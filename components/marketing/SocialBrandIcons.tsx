/** Official-looking brand marks (Lucide Linkedin is only the "in" letters). */

export function LinkedInBrandIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#FFFFFF"
        d="M7.05 9.25H4.9v9.1h2.15v-9.1ZM5.97 5.5c-.7 0-1.27.57-1.27 1.27 0 .7.57 1.28 1.27 1.28.7 0 1.27-.58 1.27-1.28 0-.7-.57-1.27-1.27-1.27ZM19.1 13.02c0-2.05-1.1-3.38-3.23-3.38-1.49 0-2.16.82-2.53 1.4v-1.2h-2.15c.03.61 0 9.1 0 9.1h2.15v-5.08c0-.27.02-.54.1-.73.22-.54.72-1.1 1.56-1.1 1.1 0 1.54.84 1.54 2.07v4.84h2.15v-5.92Z"
      />
    </svg>
  );
}

export function InstagramBrandIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="50%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#igGrad)" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="#fff" />
      <rect
        x="3.8"
        y="3.8"
        width="16.4"
        height="16.4"
        rx="4.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
      />
    </svg>
  );
}
