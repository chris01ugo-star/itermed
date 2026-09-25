"use client";

import { useMemo, useState } from "react";
import { Infinity as InfinityIcon, Minus, Plus, Search } from "lucide-react";
import { Badge } from "@/app/ui/badge";
import { Button } from "@/app/ui/button";
import type { AdminUserRow } from "@/lib/admin/users-admin";
import {
  adjustUserLimitAction,
  setUserRoleAction,
  setUserUnlimitedAction,
  toggleUserActiveAction,
} from "@/app/admin/users/actions";
import { ADMIN_ASSIGNABLE_ROLES, userRoleLabel } from "@/lib/admin/user-roles";

function formatScore(score: number | null): string {
  if (score == null) return "—";
  return `${score.toFixed(1).replace(".", ",")}/30`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function roleBadge(role: string) {
  if (role === "ADMIN") return { label: userRoleLabel(role), variant: "info" as const };
  return { label: userRoleLabel(role), variant: "default" as const };
}

export function UsersAdminPanel({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      return (
        user.email.toLowerCase().includes(q) ||
        (user.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, users]);

  const activeCount = users.filter((user) => user.isActive).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {users.length} account · {activeCount} attivi
        </p>
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca nome o email"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/45 focus:ring-4 focus:ring-[#345884]/10"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">Nessun utente corrisponde alla ricerca.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => {
            const role = roleBadge(user.role);
            const isSelf = currentUserId === user.id;
            const canDeactivate = !isSelf && !user.isPlatformAdmin;
            const canEditLimit = !user.isPlatformAdmin && user.role !== "ADMIN";
            const open = openId === user.id;

            return (
              <article
                key={user.id}
                className="rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-zinc-900">
                        {user.name || "Senza nome"}
                      </p>
                      <Badge variant={role.variant}>{role.label}</Badge>
                      {user.isPlatformAdmin ? (
                        <Badge variant="info">Piattaforma · permessi completi</Badge>
                      ) : null}
                      <Badge variant={user.isActive ? "success" : "danger"}>
                        {user.isActive ? "Attivo" : "Disattivato"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{user.email}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Iscritto il {formatDate(user.createdAt)} · {user.limitLabel}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {user.isPlatformAdmin ? (
                      <p className="text-xs text-zinc-500">
                        Account protetto: permessi completi, non si disattiva né si limita.
                      </p>
                    ) : (
                      <>
                    <form action={toggleUserActiveAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={user.isActive ? "outline" : "primary"}
                        className="text-xs"
                        disabled={!canDeactivate}
                        title={
                          !canDeactivate
                            ? "Non puoi disattivare questo account"
                            : user.isActive
                              ? "Disattiva account"
                              : "Riattiva account"
                        }
                      >
                        {user.isActive ? "Disattiva" : "Riattiva"}
                      </Button>
                    </form>

                    <form action={setUserRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="role"
                        defaultValue={
                          user.role === "INSTRUCTOR" ? "MEDICO" : user.role
                        }
                        disabled={isSelf}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800"
                      >
                        {ADMIN_ASSIGNABLE_ROLES.map((value) => (
                          <option key={value} value={value}>
                            {userRoleLabel(value)}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="outline" className="text-xs" disabled={isSelf}>
                        Salva ruolo
                      </Button>
                    </form>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Casi avviati / completati
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1E324E]">
                      {user.startedCount} avviati · {user.completedCount} referti
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Voto medio
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1E324E]">
                      {formatScore(user.avgScore)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Limite casi gratis
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <form action={adjustUserLimitAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="delta" value="-1" />
                        <Button
                          type="submit"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={!canEditLimit || user.unlimited || user.editableLimit === 0}
                          aria-label="Diminuisci limite"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                      <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-[#1E324E]">
                        {user.unlimited ? "∞" : user.editableLimit}
                      </span>
                      <form action={adjustUserLimitAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="delta" value="1" />
                        <Button
                          type="submit"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={!canEditLimit}
                          aria-label="Aumenta limite"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                      <form action={setUserUnlimitedAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant={user.unlimited ? "primary" : "outline"}
                          className="text-xs"
                          disabled={!canEditLimit}
                          title={user.unlimited ? "Torna al limite numerico" : "Rendi illimitato"}
                        >
                          <InfinityIcon className="h-3.5 w-3.5" />
                          {user.unlimited ? "Illimitato" : "∞"}
                        </Button>
                      </form>
                    </div>
                    {user.remaining != null ? (
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Ne restano {user.remaining}
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-[#345884] hover:underline"
                  onClick={() => setOpenId(open ? null : user.id)}
                >
                  {open ? "Nascondi ultimi casi" : "Vedi ultimi casi e voti"}
                </button>

                {open ? (
                  user.recentSessions.length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-500">Nessun referto completato.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-100">
                      {user.recentSessions.map((session, index) => (
                        <li
                          key={`${user.id}-${index}`}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-800">{session.caseTitle}</p>
                            <p className="text-[11px] text-zinc-400">{formatDate(session.completedAt)}</p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums text-[#1E324E]">
                            {formatScore(session.score)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
