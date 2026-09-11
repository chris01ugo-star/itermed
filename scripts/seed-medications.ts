/**
 * Seed AIFA/SSN medication formulary for pharmacoeconomic scoring.
 *
 * Prices are EUR per commercial pack from AIFA Class A/H lists
 * (aggiornamento 30/04/2026, prezzo al pubblico) unless noted.
 * The five teaching examples keep the SSN operational tariffs specified
 * for the student dashboard (Lasix ~1.76, Pantorc/Peptazol ~4.50,
 * Augmentin 7.90, Eliquis ~60.00, Rocefin ~4.50).
 *
 * Idempotent upsert on (commercialName, dosageForm).
 *
 *   npx tsx scripts/seed-medications.ts
 *   npm run db:seed:medications
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

type SeedMedication = {
  commercialName: string;
  activeIngredient: string;
  dosageForm: string;
  price: number;
  category: "Cardiologia" | "Pneumologia" | "Gastroenterologia" | "Urgenza";
  /** AIC / AIFA note for audit — not persisted. */
  source: string;
};

function aifaBandFromSourceNote(source: string): "A" | "C" | "H" {
  const match = source.match(/classe\s*([ACH])/i);
  const letter = match?.[1]?.toUpperCase();
  return letter === "C" || letter === "H" ? letter : "A";
}

const MEDICATIONS: SeedMedication[] = [
  // --- Esempi obbligatori (tariffe operative SSN / AIFA) ---
  {
    commercialName: "Lasix",
    activeIngredient: "Furosemide",
    dosageForm: "compresse 25mg",
    price: 1.76,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 023993013 LASIX*30 cpr 25 mg pubblico 1,72 € — tariffa didattica SSN 1,76 €",
  },
  {
    commercialName: "Pantorc/Peptazol",
    activeIngredient: "Pantoprazolo",
    dosageForm: "compresse 20mg",
    price: 4.5,
    category: "Gastroenterologia",
    source:
      "AIFA Classe A PANTORC*14 cpr 20 mg 5,74 € / PEPTAZOL 5,34 € / equivalente 3,94 € — tariffa SSN operativa 4,50 €",
  },
  {
    commercialName: "Augmentin",
    activeIngredient: "Amoxicillina/Acido clavulanico",
    dosageForm: "compresse 875/125mg",
    price: 7.9,
    category: "Urgenza",
    source:
      "AIFA Liste di Trasparenza gruppo CJA: prezzo di riferimento SSN 7,90 € (originatore GSK pubblico 10,20 €)",
  },
  {
    commercialName: "Eliquis",
    activeIngredient: "Apixaban",
    dosageForm: "compresse 5mg",
    price: 60.0,
    category: "Cardiologia",
    source:
      "AIFA Classe A ELIQUIS*28 cpr 5 mg 49,01 € / *60 cpr 5 mg 105,00 € — tariffa mensile operativa SSN 60,00 €",
  },
  {
    commercialName: "Rocefin",
    activeIngredient: "Ceftriaxone",
    dosageForm: "fiale 1g",
    price: 4.5,
    category: "Urgenza",
    source:
      "AIFA Classe H ROCEFIN*1 fl EV 1 g ex-factory 4,51 € (IM 1 g pubblico 6,94 €) — tariffa ospedaliera 4,50 €",
  },

  // --- Cardiologia (AIFA Classe A, 30/04/2026) ---
  {
    commercialName: "Cardioaspirin",
    activeIngredient: "Acido acetilsalicilico",
    dosageForm: "compresse gastroresistenti 100mg",
    price: 2.58,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 024840074 CARDIOASPIRIN*30 cpr gastroresistenti 100 mg",
  },
  {
    commercialName: "Plavix",
    activeIngredient: "Clopidogrel",
    dosageForm: "compresse 75mg",
    price: 18.35,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 034128013 PLAVIX*28 cpr rivestite 75 mg",
  },
  {
    commercialName: "Brilique",
    activeIngredient: "Ticagrelor",
    dosageForm: "compresse rivestite 90mg",
    price: 58.5,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 040546044 BRILIQUE*56 cpr rivestite 90 mg",
  },
  {
    commercialName: "Clexane",
    activeIngredient: "Enoxaparina sodica",
    dosageForm: "siringhe 4000 UI",
    price: 30.38,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 026966046 CLEXANE*6 siringhe 4.000 UI 0,4 ml",
  },
  {
    commercialName: "Cordarone",
    activeIngredient: "Amiodarone",
    dosageForm: "compresse 200mg",
    price: 5.42,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 025035015 CORDARONE*20 cpr 200 mg",
  },
  {
    commercialName: "Concor",
    activeIngredient: "Bisoprololo",
    dosageForm: "compresse 10mg",
    price: 6.34,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 026573016 CONCOR*28 cpr rivestite 10 mg",
  },
  {
    commercialName: "Norvasc",
    activeIngredient: "Amlodipina",
    dosageForm: "compresse 5mg",
    price: 5.53,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 027428010 NORVASC*28 cpr 5 mg",
  },
  {
    commercialName: "Enapren",
    activeIngredient: "Enalapril",
    dosageForm: "compresse 20mg",
    price: 4.91,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 025682028 ENAPREN*14 cpr 20 mg",
  },
  {
    commercialName: "Aldactone",
    activeIngredient: "Spironolattone",
    dosageForm: "compresse 100mg",
    price: 4.46,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 019822030 ALDACTONE*10 cpr rivestite 100 mg",
  },
  {
    commercialName: "Lanoxin",
    activeIngredient: "Digossina",
    dosageForm: "compresse 0.125mg",
    price: 2.07,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 015724038 LANOXIN*30 cpr 0,125 mg",
  },
  {
    commercialName: "Seloken",
    activeIngredient: "Metoprololo",
    dosageForm: "compresse rilascio prolungato 200mg",
    price: 7.0,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 023616042 SELOKEN*28 cpr 200 mg rilascio prolungato",
  },
  {
    commercialName: "Xarelto",
    activeIngredient: "Rivaroxaban",
    dosageForm: "compresse 20mg",
    price: 33.14,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 038744189 XARELTO*28 cpr rivestite 20 mg",
  },
  {
    commercialName: "Lixiana",
    activeIngredient: "Edoxaban",
    dosageForm: "compresse 60mg",
    price: 96.76,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 044315188 LIXIANA*28 cpr rivestite 60 mg",
  },
  {
    commercialName: "Bisoprololo EG",
    activeIngredient: "Bisoprololo",
    dosageForm: "compresse 2.5mg",
    price: 2.59,
    category: "Cardiologia",
    source: "AIFA Classe A AIC 039870124 BISOPROLOLO*28 cpr 2,5 mg EG",
  },

  // --- Pneumologia ---
  {
    commercialName: "Ventolin",
    activeIngredient: "Salbutamolo",
    dosageForm: "sospensione inalatoria 100mcg 200 erogazioni",
    price: 4.09,
    category: "Pneumologia",
    source: "AIFA Classe A AIC 022984052 VENTOLIN*sosp inal 200 erog 100 mcg",
  },
  {
    commercialName: "Foster",
    activeIngredient: "Beclometasone/Formoterolo",
    dosageForm: "polvere inalatoria 100/6mcg 120 dosi",
    price: 49.31,
    category: "Pneumologia",
    source: "AIFA Classe A AIC 037789031 FOSTER*polv inal 120 dosi 100 mcg + 6 mcg",
  },
  {
    commercialName: "Spiriva",
    activeIngredient: "Tiotropio",
    dosageForm: "capsule per inalazione 18mcg",
    price: 42.39,
    category: "Pneumologia",
    source: "AIFA Classe A AIC 035668058 SPIRIVA*30 cps 18 mcg handihaler",
  },
  {
    commercialName: "Seretide Diskus",
    activeIngredient: "Salmeterolo/Fluticasone",
    dosageForm: "polvere inalatoria 50/100mcg 60 dosi",
    price: 24.21,
    category: "Pneumologia",
    source: "AIFA Classe A AIC 034371043 SERETIDE*DISKUS polv inal 60 dosi 50 + 100 mcg",
  },
  {
    commercialName: "Deltacortene",
    activeIngredient: "Prednisone",
    dosageForm: "compresse 25mg",
    price: 5.87,
    category: "Pneumologia",
    source: "AIFA Classe A AIC 010089035 DELTACORTENE*10 cpr 25 mg",
  },
  {
    commercialName: "Tavanic",
    activeIngredient: "Levofloxacina",
    dosageForm: "compresse 500mg",
    price: 8.25,
    category: "Pneumologia",
    source: "AIFA Classe A AIC 033634039 TAVANIC*5 cpr rivestite 500 mg",
  },
  {
    commercialName: "Zitromax",
    activeIngredient: "Azitromicina",
    dosageForm: "compresse 500mg",
    price: 7.82,
    category: "Pneumologia",
    source: "AIFA Classe A AIC 027860042 ZITROMAX*3 cpr rivestite 500 mg",
  },

  // --- Gastroenterologia ---
  {
    commercialName: "Antra",
    activeIngredient: "Omeprazolo",
    dosageForm: "capsule gastroresistenti 20mg",
    price: 7.58,
    category: "Gastroenterologia",
    source: "AIFA Classe A AIC 028245090 ANTRA*14 cps gastroresistenti 20 mg",
  },
  {
    commercialName: "Nexium",
    activeIngredient: "Esomeprazolo",
    dosageForm: "compresse gastroresistenti 20mg",
    price: 7.08,
    category: "Gastroenterologia",
    source: "AIFA Classe A AIC 034972265 NEXIUM*14 cpr gastroresistenti 20 mg",
  },
  {
    commercialName: "Pantoprazolo Sandoz",
    activeIngredient: "Pantoprazolo",
    dosageForm: "compresse gastroresistenti 20mg",
    price: 3.94,
    category: "Gastroenterologia",
    source: "AIFA Classe A AIC 038139034 PANTOPRAZOLO*14 cpr gastroresistenti 20 mg (equivalente)",
  },
  {
    commercialName: "Normix",
    activeIngredient: "Rifaximina",
    dosageForm: "compresse 200mg",
    price: 7.56,
    category: "Gastroenterologia",
    source: "AIFA Classe A AIC 025300029 NORMIX*12 cpr rivestite 200 mg",
  },
  {
    commercialName: "Plasil",
    activeIngredient: "Metoclopramide",
    dosageForm: "fiale 10mg",
    price: 1.89,
    category: "Gastroenterologia",
    source: "AIFA Classe A AIC 020766010 PLASIL*10 mg/2 ml 5 fiale",
  },
  {
    commercialName: "Flagyl",
    activeIngredient: "Metronidazolo",
    dosageForm: "compresse 250mg",
    price: 2.57,
    category: "Gastroenterologia",
    source: "AIFA Classe A AIC 018505038 FLAGYL*20 cpr 250 mg",
  },
  {
    commercialName: "Laevolac",
    activeIngredient: "Lattulosio",
    dosageForm: "sciroppo 66.7% 180ml",
    price: 4.8,
    category: "Gastroenterologia",
    source: "AIFA Classe A AIC 022711129 LAEVOLAC EPS*sciroppo 180 ml 66,7 g/100 ml",
  },
  {
    commercialName: "Gaviscon",
    activeIngredient: "Sodio alginato / Sodio bicarbonato",
    dosageForm: "sospensione orale bustine",
    price: 8.9,
    category: "Gastroenterologia",
    source: "AIFA Classe C GAVISCON*bustine — non rimborsato SSN (fascia C)",
  },
  {
    commercialName: "Pentasa",
    activeIngredient: "Mesalazina",
    dosageForm: "compresse rilascio modificato 500mg",
    price: 20.85,
    category: "Gastroenterologia",
    source: "AIFA Classe A AIC 027130071 PENTASA*50 cpr 500 mg rilascio modificato",
  },

  // --- Urgenza / area critica ---
  {
    commercialName: "Lasix fiale",
    activeIngredient: "Furosemide",
    dosageForm: "fiale 20mg",
    price: 2.27,
    category: "Urgenza",
    source: "AIFA Classe A AIC 020465011 LASIX*5 fiale 20 mg 2 ml",
  },
  {
    commercialName: "Cordarone EV",
    activeIngredient: "Amiodarone",
    dosageForm: "fiale 150mg",
    price: 5.63,
    category: "Urgenza",
    source: "AIFA Classe H AIC 025035039 CORDARONE*6 fiale EV 150 mg 3 ml pubblico 5,63 €",
  },
  {
    commercialName: "Adrenalina",
    activeIngredient: "Adrenalina",
    dosageForm: "fiale 0.5mg",
    price: 1.22,
    category: "Urgenza",
    source: "AIFA Classe A AIC 030650016 ADRENALINA*5 fiale 0,5 mg 1 ml SALF",
  },
  {
    commercialName: "Atropina solfato",
    activeIngredient: "Atropina solfato",
    dosageForm: "fiale 0.5mg",
    price: 1.62,
    category: "Urgenza",
    source: "AIFA Classe A AIC 030653012 ATROPINA SOLFATO*5 fiale 0,5 mg 1 ml SALF",
  },
  {
    commercialName: "Toradol",
    activeIngredient: "Ketorolac",
    dosageForm: "fiale 30mg",
    price: 4.06,
    category: "Urgenza",
    source: "AIFA Classe A AIC 027253020 TORADOL*3 fiale IM EV 30 mg 1 ml",
  },
  {
    commercialName: "Morfina cloridrato",
    activeIngredient: "Morfina cloridrato",
    dosageForm: "fiale 10mg",
    price: 1.6,
    category: "Urgenza",
    source: "AIFA Classe A AIC 030798033 MORFINA CLORIDRATO*1 fiala SC IM EV 10 mg 1 ml",
  },
  {
    commercialName: "Isoptin EV",
    activeIngredient: "Verapamil",
    dosageForm: "fiale 5mg",
    price: 3.2,
    category: "Urgenza",
    source: "AIFA Classe A AIC 020609071 ISOPTIN*5 fiale EV 5 mg 2 ml",
  },
  {
    commercialName: "Glucagen",
    activeIngredient: "Glucagone",
    dosageForm: "fiale 1mg",
    price: 23.97,
    category: "Urgenza",
    source: "AIFA Classe H AIC 027489020 GLUCAGEN*1 fiala 1 mg pubblico 23,97 €",
  },
  {
    commercialName: "Solumedrol",
    activeIngredient: "Metilprednisolone",
    dosageForm: "flaconcino 500mg",
    price: 17.77,
    category: "Urgenza",
    source: "AIFA Classe A AIC 023202056 SOLUMEDROL*1 flaconcino IM EV 500 mg",
  },
  {
    commercialName: "Piperacillina/Tazobactam",
    activeIngredient: "Piperacillina/Tazobactam",
    dosageForm: "flaconcino 4g/0.5g",
    price: 13.82,
    category: "Urgenza",
    source: "AIFA Classe H AIC 037666029 PIPERACILLINA E TAZOBACTAM*1 fl EV 4 g + 0,5 g pubblico 13,82 €",
  },
  {
    commercialName: "Noradrenalina tartrato",
    activeIngredient: "Noradrenalina",
    dosageForm: "fiale 2mg/ml",
    price: 13.99,
    category: "Urgenza",
    source: "AIFA Classe H AIC 034808028 NORADRENALINA TARTRATO*10 fiale EV 1 ml 2 mg/ml pubblico 13,99 €",
  },
  {
    commercialName: "Buscopan",
    activeIngredient: "Scopolamina butilbromuro",
    dosageForm: "fiale 20mg",
    price: 2.99,
    category: "Urgenza",
    source: "AIFA Classe A AIC 006979037 BUSCOPAN*6 fiale IM EV 20 mg 1 ml",
  },
];

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Configure .env.local before running.");
  }

  if (MEDICATIONS.length < 30) {
    throw new Error(`Seed catalog too small: ${MEDICATIONS.length} (need ≥ 30).`);
  }

  const byCategory = new Map<string, number>();
  const byBand = new Map<string, number>();
  for (const med of MEDICATIONS) {
    const aifaBand = aifaBandFromSourceNote(med.source);
    byCategory.set(med.category, (byCategory.get(med.category) ?? 0) + 1);
    byBand.set(aifaBand, (byBand.get(aifaBand) ?? 0) + 1);
    const payload = {
      commercialName: med.commercialName,
      activeIngredient: med.activeIngredient,
      dosageForm: med.dosageForm,
      price: med.price,
      category: med.category,
    };
    try {
      await prisma.medication.upsert({
        where: {
          commercialName_dosageForm: {
            commercialName: med.commercialName,
            dosageForm: med.dosageForm,
          },
        },
        create: { ...payload, aifaBand } as typeof payload & { aifaBand: string },
        update: {
          activeIngredient: med.activeIngredient,
          price: med.price,
          category: med.category,
          aifaBand,
        } as { activeIngredient: string; price: number; category: string; aifaBand: string },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!/aifaBand|Unknown (?:arg|field)|column/i.test(msg)) throw error;
      await prisma.medication.upsert({
        where: {
          commercialName_dosageForm: {
            commercialName: med.commercialName,
            dosageForm: med.dosageForm,
          },
        },
        create: payload,
        update: {
          activeIngredient: med.activeIngredient,
          price: med.price,
          category: med.category,
        },
      });
      await prisma.$executeRaw`
        UPDATE "Medication"
        SET "aifaBand" = ${aifaBand}
        WHERE "commercialName" = ${med.commercialName}
          AND "dosageForm" = ${med.dosageForm}
      `;
    }
  }

  const total = await prisma.medication.count();
  console.log(`Seeded ${MEDICATIONS.length} medications (${total} rows in Medication).`);
  console.log("By category:");
  for (const [category, count] of [...byCategory.entries()].sort()) {
    console.log(`  ${category}: ${count}`);
  }
  console.log("By AIFA band:");
  for (const [band, count] of [...byBand.entries()].sort()) {
    console.log(`  Fascia ${band}: ${count}`);
  }

  const required = ["Lasix", "Pantorc/Peptazol", "Augmentin", "Eliquis", "Rocefin"];
  const rows = await prisma.medication.findMany({
    where: { commercialName: { in: required } },
    select: { commercialName: true, dosageForm: true, price: true, category: true },
    orderBy: { commercialName: "asc" },
  });
  console.log("\nRequired examples:");
  console.table(rows);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
