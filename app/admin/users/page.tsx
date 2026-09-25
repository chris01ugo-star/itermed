import { UsersAdminPanel } from "@/components/admin/UsersAdminPanel";
import { listAdminUsers } from "@/lib/admin/users-admin";
import { requireAdmin } from "@/lib/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";

export default async function AdminUsersPage() {
  const actor = await requireAdmin();
  const users = await listAdminUsers();

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Gestione utenti</h1>
        <p className="text-sm text-zinc-500">
          Attiva o disattiva gli account, regola i casi gratis e monitora simulazioni e voti.
        </p>
      </header>

      <Card className="bg-white/80 border-zinc-200/80">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-950">Utenti</CardTitle>
          <CardDescription>
            Il limite vale per tutta la vita dell&apos;account (pilota 3, omaggio 20, oppure il
            valore che assegni tu). Gli admin restano illimitati.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersAdminPanel users={users} currentUserId={actor.id} />
        </CardContent>
      </Card>
    </div>
  );
}
