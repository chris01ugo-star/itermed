/** Single localStorage flag for the clinical simulator guide. One key for every non-lab case. */
export const AEQUAN_TUTORIAL_SEEN_V2 = "AEQUAN_TUTORIAL_SEEN_V2";

/** Separate flag so a completed clinical guide does not hide the laboratory bench guide. */
export const AEQUAN_LAB_TUTORIAL_SEEN_V1 = "AEQUAN_LAB_TUTORIAL_SEEN_V1";

export function hasSeenSimulatorTutorial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AEQUAN_TUTORIAL_SEEN_V2) === "true";
  } catch {
    return true;
  }
}

export function markSimulatorTutorialSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AEQUAN_TUTORIAL_SEEN_V2, "true");
  } catch {
    // Private mode or quota: the guide may appear again on the next visit.
  }
}

export function hasSeenLabSimulatorTutorial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AEQUAN_LAB_TUTORIAL_SEEN_V1) === "true";
  } catch {
    return true;
  }
}

export function markLabSimulatorTutorialSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AEQUAN_LAB_TUTORIAL_SEEN_V1, "true");
  } catch {
    // Private mode or quota: the laboratory guide may appear again on the next visit.
  }
}
