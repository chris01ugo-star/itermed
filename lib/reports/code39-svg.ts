/** Code 39 patterns: n = narrow, w = wide. */
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

export function sanitizeCode39(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^0-9A-Z\-. $/+%]/g, "")
    .slice(0, 24);
}

/** SVG path of a Code 39 barcode (quiet zone included). */
export function code39Bars(value: string): { d: string; width: number; height: number } {
  const payload = `*${sanitizeCode39(value) || "AEQUAN"}*`;
  const narrow = 1.4;
  const wide = narrow * 2.4;
  const height = 36;
  const gap = narrow;
  let x = wide * 2;
  const rects: string[] = [];

  for (const char of payload) {
    const pattern = CODE39[char];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i += 1) {
      const w = pattern[i] === "w" ? wide : narrow;
      if (i % 2 === 0) {
        rects.push(`M${x.toFixed(2)} 0h${w.toFixed(2)}v${height}h-${w.toFixed(2)}z`);
      }
      x += w;
    }
    x += gap;
  }
  x += wide * 2;

  return { d: rects.join(""), width: Math.ceil(x), height };
}
