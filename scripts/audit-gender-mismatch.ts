/**
 * Audit di coerenza sesso / nome / aggettivi sui casi clinici.
 *
 *   npx tsx scripts/audit-gender-mismatch.ts
 *
 * Scansiona i JSON in knowledge_base/<specialità>/cases e i casi TypeScript
 * in lib/data/cases. Stampa WARNING (nome femminile con sex M) ed ERROR
 * (aggettivi del sesso opposto nel testo).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

const FEMALE_GIVEN_NAMES = new Set([
  "anna",
  "elena",
  "maria",
  "rosa",
  "giulia",
  "sara",
  "chiara",
  "francesca",
  "lucia",
  "laura",
  "federica",
  "sofia",
  "martina",
  "alessia",
  "valentina",
  "silvia",
  "paola",
  "carla",
  "teresa",
  "giovanna",
  "angela",
  "rita",
  "beatrice",
  "irene",
  "alice",
  "emma",
  "giada",
  "elisa",
  "monica",
  "stefania",
  "daniela",
  "roberta",
  "simona",
  "patrizia",
  "cristina",
  "antonella",
  "marta",
  "giovanna",
  "caterina",
  "barbara",
  "claudia",
  "debora",
  "eleonora",
  "flavia",
  "gabriella",
  "ilaria",
  "linda",
  "nadia",
  "ornella",
  "rachele",
  "sabrina",
  "tiziana",
  "veronica",
  "adele",
  "bianca",
  "cecilia",
  "daria",
  "noemi",
  "pia",
]);

/** Nomi maschili che finiscono in -a: non sono un mismatch. */
const MALE_GIVEN_NAMES_ENDING_A = new Set([
  "andrea",
  "nicola",
  "mattia",
  "elia",
  "battista",
  "luca",
]);

const MASCULINE_IN_FEMALE = /\b(stanco|operato|ricoverato|nato|affetto|allergico|sicuro)\b/gi;
const FEMININE_IN_MALE = /\b(stanca|operata|ricoverata|nata|affetta|allergica|sicura)\b/gi;

type Sex = "M" | "F";

type Finding = {
  level: "WARNING" | "ERROR";
  file: string;
  id: string;
  sex: Sex | null;
  name: string;
  message: string;
  detail: string;
};

function walk(dir: string, accept: (file: string) => boolean, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    let info: ReturnType<typeof statSync>;
    try {
      info = statSync(path);
    } catch {
      continue;
    }
    if (info.isDirectory()) walk(path, accept, out);
    else if (accept(path)) out.push(path);
  }
  return out;
}

function normalizeSex(raw: unknown): Sex | null {
  const value = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (value === "M" || value === "MASCHIO" || value === "MASCHILE" || value === "UOMO" || value === "MALE") {
    return "M";
  }
  if (value === "F" || value === "FEMMINA" || value === "FEMMINILE" || value === "DONNA" || value === "FEMALE") {
    return "F";
  }
  return null;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) collectStrings(nested, out);
  }
  return out;
}

function readPath(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function givenName(full: string): string {
  const token = full
    .replace(/^[^A-Za-zÀ-ÿ]+/, "")
    .split(/\s+/)[0]
    ?.replace(/[^A-Za-zÀ-ÿ'-]/g, "");
  return token ?? "";
}

function nameFromNarrative(texts: string[]): string {
  const blob = texts.join("\n");
  const match = blob.match(
    /\b(?:Mi chiamo|Sei)\s+([A-ZÀ-Ý][a-zà-ÿ]{2,})(?:\s+([A-ZÀ-Ý][a-zà-ÿ]{2,}))?/,
  );
  const sono = blob.match(/\bSono\s+([A-ZÀ-Ý][a-zà-ÿ]{2,})(?:\s+([A-ZÀ-Ý][a-zà-ÿ]{2,}))?/);
  const picked = match ?? sono;
  if (!picked) return "";
  const first = picked[1] ?? "";
  if (/^(La|Il|Un|Una|Molto|Sempre|Qui|Venut[oa])$/.test(first)) return "";
  if (!FEMALE_GIVEN_NAMES.has(first.toLowerCase()) && !/^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(first)) return "";
  return [first, picked[2]].filter(Boolean).join(" ");
}

function looksLikeFemaleGivenName(name: string): boolean {
  const given = givenName(name).toLowerCase();
  if (!given || given.length < 3) return false;
  if (MALE_GIVEN_NAMES_ENDING_A.has(given)) return false;
  if (FEMALE_GIVEN_NAMES.has(given)) return true;
  return given.endsWith("a");
}

function snippets(text: string, pattern: RegExp): string[] {
  const found: string[] = [];
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(global)) {
    const index = match.index ?? 0;
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + match[0].length + 40);
    const clip = text.slice(start, end).replace(/\s+/g, " ").trim();
    const label = `${match[0].toLowerCase()} → «${clip}»`;
    if (!found.includes(label)) found.push(label);
    if (found.length >= 6) break;
  }
  return found;
}

function auditRecord(file: string, record: Record<string, unknown>, findings: Finding[]): void {
  const baseline = readPath(record, ["baselineExamFindings"]);
  const sex = normalizeSex(
    firstString(
      readPath(baseline as Record<string, unknown>, ["demographics", "sex"]),
      readPath(record, ["demographics", "sex"]),
      readPath(record, ["patient", "sex"]),
      readPath(record, ["patient", "gender"]),
      record.sex,
    ) ||
      readPath(baseline as Record<string, unknown>, ["demographics", "sex"]) ||
      readPath(record, ["sex"]),
  );
  const strings = collectStrings(record);
  const explicitName = firstString(
    readPath(baseline as Record<string, unknown>, ["demographics", "name"]),
    readPath(record, ["demographics", "name"]),
    readPath(record, ["patient", "name"]),
    readPath(record, ["patientName"]),
  );
  const name = explicitName || nameFromNarrative(strings);
  const id = firstString(record.id, record.code) || relative(ROOT, file);

  if (sex === "M" && looksLikeFemaleGivenName(name)) {
    findings.push({
      level: "WARNING",
      file: relative(ROOT, file),
      id,
      sex,
      name,
      message: "WARNING: Possibile sesso errato per il nome",
      detail: `sex M con nome «${name}»`,
    });
  }

  if (!sex) return;
  const pattern = sex === "F" ? MASCULINE_IN_FEMALE : FEMININE_IN_MALE;
  const hits = snippets(strings.join("\n"), pattern);
  if (hits.length === 0) return;
  findings.push({
    level: "ERROR",
    file: relative(ROOT, file),
    id,
    sex,
    name,
    message:
      sex === "F"
        ? "ERROR: Paziente F usa termini M nel testo"
        : "ERROR: Paziente M usa termini F nel testo",
    detail: hits.join(" | "),
  });
}

function sexFromSource(source: string): Sex | null {
  const demographic = source.match(/demographics\s*:\s*\{[\s\S]{0,400}?sex\s*:\s*["']([MF])["']/);
  if (demographic) return normalizeSex(demographic[1]);
  const plain = source.match(/\bsex\s*:\s*["']([MF])["']/);
  return plain ? normalizeSex(plain[1]) : null;
}

function auditTypeScript(file: string, findings: Finding[]): void {
  const source = readFileSync(file, "utf8");
  const sex = sexFromSource(source);
  const nameMatch = source.match(/\bname\s*:\s*["']([A-ZÀ-Ý][^"']{1,60})["']/);
  const narrative = source.match(/\b(?:Mi chiamo|Sono|Sei)\s+([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)?)/);
  const name = nameMatch?.[1] || narrative?.[1] || "";
  const idMatch = source.match(/\bid\s*:\s*["']([^"']+)["']/);
  const id = idMatch?.[1] || relative(ROOT, file);
  const fake: Record<string, unknown> = {
    id,
    sex,
    patientName: name,
    patientPrompt: source,
  };
  auditRecord(file, fake, findings);
}

function main(): void {
  const jsonFiles = walk(join(ROOT, "knowledge_base"), (file) => {
    const normalized = file.replace(/\\/g, "/");
    return normalized.includes("/cases/") && normalized.endsWith(".json");
  });
  const tsFiles = walk(join(ROOT, "lib", "data", "cases"), (file) => {
    const base = file.replace(/\\/g, "/");
    if (!base.endsWith(".ts")) return false;
    if (base.endsWith(".test.ts")) return false;
    if (/\/(types|registry|registry-store|index|kb-mapper|load-kb-case-file)\.ts$/.test(base)) return false;
    if (base.endsWith("/from-knowledge-base.ts")) return false;
    return /\/cardiologia\/car-/.test(base);
  });

  const findings: Finding[] = [];
  let parsed = 0;
  let unreadable = 0;

  for (const file of jsonFiles) {
    try {
      const record = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      parsed += 1;
      auditRecord(file, record, findings);
    } catch {
      unreadable += 1;
      console.log(`SKIP: JSON non leggibile ${relative(ROOT, file)}`);
    }
  }
  for (const file of tsFiles) {
    parsed += 1;
    auditTypeScript(file, findings);
  }

  console.log("=== Audit genere casi clinici ===");
  console.log(`JSON casi: ${jsonFiles.length}`);
  console.log(`TS casi: ${tsFiles.length}`);
  console.log(`Letti: ${parsed}  non leggibili: ${unreadable}`);
  console.log("");

  const warnings = findings.filter((item) => item.level === "WARNING");
  const errors = findings.filter((item) => item.level === "ERROR");
  for (const item of [...warnings, ...errors]) {
    console.log(item.message);
    console.log(`  file: ${item.file}`);
    console.log(`  id: ${item.id}  sex: ${item.sex ?? "n/d"}  nome: ${item.name || "n/d"}`);
    console.log(`  ${item.detail}`);
    console.log("");
  }

  const caseIds = new Set(findings.map((item) => item.id));
  console.log("--- Riepilogo ---");
  console.log(`WARNING nome/sesso: ${warnings.length}`);
  console.log(`ERROR testo/sesso: ${errors.length}`);
  console.log(`Casi con almeno un rilievo: ${caseIds.size}`);
}

main();
