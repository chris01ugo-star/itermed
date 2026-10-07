/** Client-only localStorage key for first-run simulator tutorial. */
export const AEQUAN_TUTORIAL_STORAGE_KEY = "AEQUAN_TUTORIAL_COMPLETED_V1";

/** Case-specific coach marks for TUTORIAL-001. Separate from the generic modal. */
export const AEQUAN_CASE_TOUR_STORAGE_KEY = "AEQUAN_CASE_TOUR_TUTORIAL_001";

export function readTutorialCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AEQUAN_TUTORIAL_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function writeTutorialCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AEQUAN_TUTORIAL_STORAGE_KEY, "true");
  } catch {
    // Private mode / quota — ignore; tutorial may reappear next visit.
  }
}

export function readCaseTourCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AEQUAN_CASE_TOUR_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function writeCaseTourCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AEQUAN_CASE_TOUR_STORAGE_KEY, "true");
  } catch {
    // Private mode / quota — ignore; tour may reappear next visit.
  }
}
