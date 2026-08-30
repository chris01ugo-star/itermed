# Database workflow (Prisma + Neon)

Procedura standard per modificare lo schema PostgreSQL in modo tracciato e deployabile in produzione.

## Script disponibili

| Comando | Uso |
|---------|-----|
| `npm run db:migrate` | Sviluppo: crea e applica una nuova migrazione da `schema.prisma` |
| `npm run db:deploy` | Produzione/CI: applica le migrazioni già committate in `prisma/migrations/` |
| `npm run db:status` | Verifica quali migrazioni sono applicate sul database collegato |
| `npm run db:generate` | Rigenera il client Prisma dopo una modifica allo schema |

## Flusso di sviluppo (ogni modifica allo schema)

1. **Modifica** `prisma/schema.prisma` (nuovi modelli, campi, enum, relazioni).
2. **Crea e applica** la migrazione in locale:
   ```bash
   npm run db:migrate
   ```
   Prisma chiederà un nome descrittivo (es. `add_medical_specialties`).
3. **Verifica** che in `prisma/migrations/` sia comparso un nuovo folder con `migration.sql`.
4. **Commit** insieme al codice:
   - `prisma/schema.prisma`
   - `prisma/migrations/<timestamp>_<nome>/migration.sql`
5. **Deploy** in produzione (dopo merge):
   ```bash
   npm run db:deploy
   ```

> Non usare `prisma db push` per modifiche strutturali in team o in produzione: non genera file di migrazione e non è riproducibile tra ambienti.

## Produzione

- Le migrazioni vanno applicate **prima** o **durante** il deploy dell'app, con `DATABASE_URL` puntato al database di produzione.
- Su Vercel il comando `npm run build` esegue automaticamente `prisma migrate deploy` (usa `DATABASE_URL` delle env Vercel).
- In CI/CD tipico: `npm run db:deploy && npm run build`.
- Controllare sempre lo stato prima del deploy:
  ```bash
  npm run db:status
  ```

## Stato migrazioni (aggiornato)

- Baseline completata: 9 migrazioni storiche + `sync_app_config` marcate come applied.
- Migrazione feature: `20260714110258_add_specialties_difficulty_and_scores` applicata su Neon.
- Waitlist beta: `20260830120000_beta_waitlist` (tabella `BetaWaitlistEntry`) — applicata al prossimo deploy Vercel via `migrate deploy`.
- Verifica: `npm run db:status` → **Database schema is up to date!**


## Regole di team

- Una modifica schema = una migrazione = un commit (o inclusa nello stesso PR della feature).
- Non modificare a mano SQL già applicato in produzione.
- Non committare migrazioni generate su uno schema diverso da quello del team.
- In caso di conflitto su `schema.prisma`, risolvere il conflitto **prima** di eseguire `db:migrate`.
