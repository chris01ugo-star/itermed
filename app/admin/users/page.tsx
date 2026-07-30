import { revalidatePath } from "next/cache";
import { createLogger } from "../../../lib/logger";
import { requireAdmin } from "../../../lib/require-user";
import { prisma } from "../../../lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";

const adminAuditLogger = createLogger("admin-audit");

async function setUserRole(formData: FormData) {
  "use server";

  const actor = await requireAdmin();
  const actorId = actor.id;
  if (!actorId) return;

  const userId = formData.get("userId");
  const role = formData.get("role");
  if (typeof userId !== "string" || !userId) return;
  if (role !== "ADMIN" && role !== "STUDENT" && role !== "INSTRUCTOR") return;
  if (userId === actorId && role !== "ADMIN") return;

  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!previous) return;
  if (previous.role === role) return;

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  adminAuditLogger.info("user.role.changed", {
    event: "user.role.changed",
    actorId,
    actorEmail: actor.email,
    targetUserId: userId,
    targetEmail: previous.email,
    previousRole: previous.role,
    newRole: role,
  });

  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  const user = await requireAdmin();
  const currentUserId = user.id;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Gestione utenti</h1>
        <p className="text-sm text-zinc-400">
          Visualizza utenti registrati e assegna/rimuovi il ruolo admin.
        </p>
      </header>

      <Card className="bg-white/80 border-zinc-200/80">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-950">Utenti</CardTitle>
          <CardDescription>{users.length} account registrati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {users.length === 0 ? (
            <p className="text-zinc-500">Nessun utente registrato.</p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-zinc-200/80 bg-white px-3 py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{user.name || "Senza nome"}</p>
                  <p className="truncate text-xs text-zinc-500">{user.email}</p>
                  <p className="text-[11px] text-zinc-400">
                    Ruolo: {user.role} · creato il{" "}
                    {user.createdAt.toLocaleDateString("it-IT")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {user.role !== "ADMIN" ? (
                    <form action={setUserRole}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="role" value="ADMIN" />
                      <Button type="submit" size="sm" className="text-xs">
                        Rendi admin
                      </Button>
                    </form>
                  ) : (
                    <form action={setUserRole}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="role" value="STUDENT" />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        disabled={currentUserId === user.id}
                        title={
                          currentUserId === user.id
                            ? "Non puoi rimuovere il ruolo admin dal tuo account"
                            : "Rimuovi ruolo admin"
                        }
                      >
                        Rimuovi admin
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
