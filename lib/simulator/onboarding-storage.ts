/** Single localStorage flag for the simulator guide. One key for every case. */
export const AEQUAN_TUTORIAL_SEEN_V2 = "AEQUAN_TUTORIAL_SEEN_V2";

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
