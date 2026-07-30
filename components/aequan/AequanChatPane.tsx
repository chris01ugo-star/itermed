"use client";

import type { MockChatMessage } from "@/lib/mock-data/aequan-mock-data";
import { cn } from "@/app/utils/cn";
import { AiTransparencyBadge } from "@/components/legal/AiTransparencyBadge";

type AequanChatPaneProps = {
  messages: MockChatMessage[];
  className?: string;
};

/** Left-pane medical chat — patient bubbles on ui-bg, doctor on brand-primary. */
export function AequanChatPane({ messages, className }: AequanChatPaneProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <div className="shrink-0 space-y-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">Dialogo con il paziente</p>
        <AiTransparencyBadge variant="workspace" />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg) => {
          const isDoctor = msg.role === "doctor";
          return (
            <div
              key={msg.id}
              className={cn("flex", isDoctor ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  isDoctor
                    ? "rounded-br-sm bg-[#1E324E] text-white"
                    : "rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-700",
                )}
              >
                <p>{msg.content}</p>
                <span
                  className={cn(
                    "mt-1 block font-mono text-xs",
                    isDoctor ? "text-white/70" : "text-slate-400",
                  )}
                >
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white p-3">
        <textarea
          rows={2}
          placeholder="Scrivi la prossima domanda al paziente…"
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#1E324E] focus:outline-none focus:ring-2 focus:ring-[#1E324E]/20"
        />
      </div>
    </div>
  );
}
