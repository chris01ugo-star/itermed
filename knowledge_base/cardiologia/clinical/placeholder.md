# Knowledge Base — Cardiologia / CLINICAL (placeholder)

Cartella destinata a **linee guida ESC, PDTA e algoritmi ACLS/BLS** per il pilastro CLINICAL
(`scripts/ingest-specialty-docs.ts` → `knowledge_base/cardiologia/clinical/`).

## Fonti attese (da `rag_knowledge_base/cardiologia/01_linee_guida/` e `02_protocolli_pdta/`)

### Linee guida

| File atteso | Tema |
|---|---|
| `2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf` | SCA / ACS |
| `2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf` | Scompenso cardiaco |
| `Linee-Guida-ESC-2020-sulla-Gestione-della-Fibrillazione-Atriale-1.pdf` | Fibrillazione atriale |
| `PMID-36017572_ESCGuideline_Zeppenfeld.pdf` | Aritmie ventricolari / morte improvvisa |

### Protocolli / algoritmi

| File atteso | Tema |
|---|---|
| `Algorithm-BLS-Adult-Healthcare-250701.pdf` | BLS adulto |
| `PCAC-Algorithm-ACLS-PCAC-250527.pdf` | ACLS / PCAC |
| `51_ZAino.pdf` | Protocollo clinico citato nei casi D04 |

## Istruzioni

1. Copiare i PDF clinici in questa cartella (sotto-cartelle opzionali consentite: lo script scansiona in ricorsione).
2. Ingest: `npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --update`
3. Rimuovere questo placeholder dopo l’inserimento dei documenti reali.

> Stato: **nessun PDF clinico presente nel repository** al bootstrap KB
> (i path sono citati nei Gold Standard `lib/data/cases/cardiologia/car-*.ts` ma i file non risultano versionati).
