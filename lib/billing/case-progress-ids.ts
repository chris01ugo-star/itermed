import { compactCaseKey, knowledgeBaseIdCandidates } from "@/lib/data/cases/registry-store";

/** Map a stored session/report caseId onto the ids shown in Prassi. */
export function displayIdsForStoredCaseId(storedId: string, displayIds: string[]): string[] {
  const storedKeys = new Set(knowledgeBaseIdCandidates(storedId));
  const storedCompact = compactCaseKey(storedId);
  return displayIds.filter((id) => {
    if (knowledgeBaseIdCandidates(id).some((key) => storedKeys.has(key))) return true;
    return storedCompact.length > 0 && compactCaseKey(id) === storedCompact;
  });
}

export function expandLookupIds(caseIds: string[]): string[] {
  const out = new Set<string>();
  for (const id of caseIds) {
    for (const candidate of knowledgeBaseIdCandidates(id)) out.add(candidate);
    const compact = compactCaseKey(id);
    if (compact) out.add(compact);
  }
  return [...out];
}
