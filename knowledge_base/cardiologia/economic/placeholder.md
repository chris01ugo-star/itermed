# Knowledge Base — Cardiologia / ECONOMIC (placeholder)

Cartella destinata a **tariffari SSN, Note AIFA e prontuario** per il pilastro ECONOMIC
(`scripts/ingest-specialty-docs.ts` → `knowledge_base/cardiologia/economic/`).

Formati supportati: `.pdf`, `.md`, `.txt`, `.json`, `.csv`.

## Fonti attese (da `rag_knowledge_base/cardiologia/03_prontuario_ssn/` e nomenclatore)

| File / risorsa attesa | Uso tipico |
|---|---|
| `nota-95.pdf` | Nota AIFA 95 (prescrivibilità farmaci cardiologici) |
| Nomenclatore Tariffario SSN (CSV/JSON/PDF) | Codici prestazione e importi € per audit economico |
| Estratti prontuario regionale / LEA | Appropriatezza e rimborsabilità |

## Istruzioni

1. Inserire tariffari e note AIFA in questa cartella.
2. Preferire CSV/JSON con colonne `codice`, `descrizione`, `tariffa`/`prezzo` per il formatter € SSN dello script.
3. Ingest: `npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --update`
4. Rimuovere questo placeholder dopo il caricamento dei documenti reali.

> Stato: **nessun tariffario/nota AIFA presente nel repository** al bootstrap KB.
