"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, Search } from "lucide-react";
import { initialsFromLabel } from "@/lib/avatar-initials";

type TopBarProps = {
  userLabel: string;
  showSearch?: boolean;
};

export function TopBar({ userLabel, showSearch = true }: TopBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/dashboard/prassi?q=${encodeURIComponent(trimmed)}` : "/dashboard/prassi");
  };

  return (
    <div className="relative z-10 flex h-16 shrink-0 items-center gap-4 border-b border-slate-100 bg-white px-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {showSearch ? (
        <form onSubmit={handleSubmit} className="min-w-0 max-w-md flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca un caso clinico…"
              aria-label="Cerca un caso clinico"
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#1E324E]/30 focus:bg-white focus:ring-2 focus:ring-[#1E324E]/10"
            />
          </div>
        </form>
      ) : (
        <div className="flex-1" />
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
          aria-label="Notifiche"
        >
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <div className="ml-1 h-8 w-px bg-slate-100" aria-hidden />
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E324E] text-xs font-semibold text-white">
          {initialsFromLabel(userLabel)}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
        </span>
      </div>
    </div>
  );
}
