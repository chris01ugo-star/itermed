# Aequan — abbonamenti, crediti e referral

Il sistema è persistente su PostgreSQL (Prisma). I crediti mostrati in UI arrivano sempre dal backend. Stripe Checkout / Billing è l’integrazione di pagamento; senza chiavi l’app resta usabile per i tester esistenti e mostra un avviso in dashboard.

## Variabili d’ambiente

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Piani mensili (gli alias START/PLUS sono preferiti; STUDENT/PREMIUM restano validi)
STRIPE_PRICE_START=price_...
STRIPE_PRICE_PLUS=price_...
STRIPE_PRICE_STUDENT=price_...   # fallback Start
STRIPE_PRICE_PREMIUM=price_...   # fallback Plus

# Pacchetto 5 simulazioni extra — 4,90 € (pagamento unico)
STRIPE_PRICE_EXTRA_CREDITS=price_...
```

Non committare valori reali. In test mode usa chiavi `sk_test_` / `pk_test_` e price ID di test.

Crea (o riusa) i tre prodotti sul account Stripe **test** e allinea il Customer Portal:

```bash
npm run stripe:bootstrap
```

Lo script legge `STRIPE_SECRET_KEY` da `.env.local` (gitignored) ed è idempotente tramite metadata `aequan_sku`. Copia gli ID prezzo stampati nelle env Vercel. Webhook in locale: `stripe listen --forward-to localhost:3000/api/billing/webhook`. In produzione l’endpoint Dashboard è `https://<dominio>/api/billing/webhook` (live keys).

## Prodotti Stripe da creare

| Prodotto | Tipo | Importo | Price ID env |
| --- | --- | --- | --- |
| Aequan Start | Subscription, mensile, EUR | 9,90 € | `STRIPE_PRICE_START` |
| Aequan Plus | Subscription, mensile, EUR | 16,90 € | `STRIPE_PRICE_PLUS` |
| 5 simulazioni extra | One-time, EUR | 4,90 € | `STRIPE_PRICE_EXTRA_CREDITS` |

Catalogo **test** già creato sull’account Stripe IT (`aequan_sku`):

```
STRIPE_PRICE_START=price_1Uf39o3SDEJLWXWsC8URtCSR
STRIPE_PRICE_PLUS=price_1Uf39o3SDEJLWXWsZ8VcFkQO
STRIPE_PRICE_EXTRA_CREDITS=price_1Uf39o3SDEJLWXWsL3jxpuHi
```

In live mode ricrea i prezzi (non riusare questi ID) e abilita Stripe Tax dopo sede legale + registrazione IVA. Oggi Tax Settings è `pending` (nessuna head office, nessuna registration): `automatic_tax` non è attivo, altrimenti Stripe calcolerebbe 0 IVA senza errore.

Crediti del piano: Start 12/mese (cap mensile 24), Plus 30/mese (cap mensile 60). Gli extra e i bonus referral **non** entrano nel cap mensile.

## Webhook

Endpoint: `POST /api/billing/webhook`

Eventi da abilitare:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `charge.dispute.created`
- `radar.early_fraud_warning.created`

Configura il Customer Portal Stripe (upgrade/downgrade, cancellazione a fine periodo, fatture). `POST /api/billing/portal` apre la sessione.

Gli eventi sono idempotenti (`StripeProcessedEvent` + chiavi `CreditTransaction.idempotencyKey`). Un webhook duplicato o in ritardo non riaccredita.

## Crediti

- **Mensili**: accreditati solo su `invoice.paid` con `billing_reason` `subscription_create` o `subscription_cycle`.
- **Acquistati**: +5 dopo `checkout.session.completed` del pacchetto extra.
- **Referral**: +10 invitante / +5 invitato solo dopo il **primo** pagamento di abbonamento confermato server-side.
- Consumo: 1 credito per nuova `CaseSession` AI, ordine mensili → extra → referral, lock `FOR UPDATE`.
- Ripresa di una sessione interrotta: nessun nuovo consumo.
- Consultazione report: nessun consumo.
- Errore tecnico dopo il create: il credito viene restituito.
- Senza abbonamento attivo non si possono usare i crediti extra/referral per nuove simulazioni. Report e storico restano aperti.
- Admin piattaforma / account illimitati / INVITED / BETA_TESTER / pilota universitario: restano sul modello di entitlement precedente finché non si abbonano.

## Referral

Codice personale `AEQUAN-XXXXX`, non modificabile. Campo “Codice invito (facoltativo)” nel checkout interno **prima** di Stripe Checkout (non è un coupon Stripe). Link: `/invite/AEQUAN-XXXXX`.

Protezioni: un solo referral per account, niente auto-invito, rinnovi e riattivazioni non pagano di nuovo, fingerprint carta già usata su un altro first-paid → `INVALID`, rate limit sull’apply, sospensione admin.

Rimborso/chargeback del primo pagamento: revoca dei bonus non ancora spesi (i bucket non scendono sotto zero).

## Migrazione

`prisma/migrations/20261123190000_saas_credits_referrals` è additiva (colonne e tabelle nuove). Nessun drop sui dati utente.

## Pagamenti non testati in questo ambiente

Il checkout Stripe non è stato eseguito con chiavi live/test di produzione in questa sessione. Finché i price ID e il webhook non sono configurati, i pagamenti **non** sono operativi.
