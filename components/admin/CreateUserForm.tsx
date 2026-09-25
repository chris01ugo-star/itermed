"use client";

import { useActionState, useState } from "react";
import { Button } from "@/app/ui/button";
import { createUserAction, type CreateUserState } from "@/app/admin/users/actions";
import { ADMIN_ASSIGNABLE_ROLES, userRoleLabel } from "@/lib/admin/user-roles";

const initialState: CreateUserState = { status: "idle" };

const fieldClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/45 focus:ring-4 focus:ring-[#345884]/10";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initialState);
  const [role, setRole] = useState("STUDENT");

  return (
    <form
      key={state.status === "ok" ? state.email : "create-user"}
      action={action}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Nome
          </span>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Mario Rossi"
            className={fieldClassName}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="mario.rossi@unito.it"
            className={fieldClassName}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Password
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Almeno 8 caratteri"
            className={fieldClassName}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Ruolo
          </span>
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={fieldClassName}
          >
            {ADMIN_ASSIGNABLE_ROLES.map((value) => (
              <option key={value} value={value}>
                {userRoleLabel(value)}
              </option>
            ))}
          </select>
        </label>
        {role === "ADMIN" ? (
          <p className="text-xs text-zinc-500 sm:col-span-2">
            Gli admin non hanno limite casi.
          </p>
        ) : (
          <label className="space-y-1.5 text-sm sm:col-span-2 sm:max-w-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Limite casi gratis
            </span>
            <input
              name="freeSimulationLimit"
              type="number"
              min={0}
              max={500}
              defaultValue={3}
              className={fieldClassName}
            />
          </label>
        )}
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-rose-600" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "ok" ? (
        <p className="text-sm text-emerald-700" role="status">
          Account creato: {state.email}. Può accedere subito con email e password.
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creazione..." : "Aggiungi utente"}
      </Button>
    </form>
  );
}
