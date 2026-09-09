# Knowledge Base — Cardiologia / LEGAL (placeholder)

Cartella destinata ai documenti **medico-legali** per il pilastro LEGAL della pipeline RAG
(`scripts/ingest-specialty-docs.ts` → `knowledge_base/cardiologia/legal/`).

## Fonti attese (da `rag_knowledge_base/_common_legal/` e citazioni casi CAR-*)

| File atteso | Uso tipico |
|---|---|
| `CODICE-DEONTOLOGIA-MEDICA-2014.pdf` | Art. 13 (appropriatezza), Art. 20/24 (comunicazione/consenso) |
| `227-20170317-legge-cd-gelli.pdf` | Legge Gelli-Bianco (responsabilità professionale) |
| `Legge_219_2017_Consenso_Informato.pdf` | Consenso informato |

## Istruzioni

1. Copiare i PDF ufficiali in questa cartella (nomenclatura invariata preferita).
2. Eseguire: `npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --update`
3. Rimuovere questo `placeholder.md` dopo l’inserimento dei documenti reali (evita chunk spurii).

> Stato: **nessun PDF legale cardiologico presente nel repository** al bootstrap KB.
