const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC =
  "C:/Users/chris/.cursor/projects/c-Users-chris-Desktop-Praesidium-itermed/assets/c__Users_chris_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_IMG_0371-76a3e7f7-852b-4d33-9038-7a0ed1c7a7f7.png";
const APP = path.join(__dirname, "..", "app");
const SIZE = 512;
const PAD = 0.1;

function isInk(r, g, b, a) {
  if (a < 40) return false;
  // near-white / light grey background
  if (r > 240 && g > 240 && b > 240) return false;
  return true;
}

function isBlueMark(r, g, b, a) {
  if (!isInk(r, g, b, a)) return false;
  // Navy ribbon: blue channel dominates; exclude charcoal wordmark (r≈g≈b)
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return b > 60 && b >= r + 20 && b >= g + 15 && chroma > 25 && r < 120;
}

async function main() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const rowInk = new Array(h).fill(0);
  const rowBlue = new Array(h).fill(0);

  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0;
  let markMinX = w,
    markMinY = h,
    markMaxX = 0,
    markMaxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (isInk(r, g, b, a)) {
        rowInk[y]++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (isBlueMark(r, g, b, a)) {
        rowBlue[y]++;
        markMinX = Math.min(markMinX, x);
        markMinY = Math.min(markMinY, y);
        markMaxX = Math.max(markMaxX, x);
        markMaxY = Math.max(markMaxY, y);
      }
    }
  }

  // Prefer blue-mark bbox; fall back to upper content band before the largest ink gap.
  let bx1, by1, bx2, by2;
  if (markMaxX > markMinX && markMaxY > markMinY) {
    bx1 = markMinX;
    by1 = markMinY;
    bx2 = markMaxX;
    by2 = markMaxY;
    console.log("crop: blue mark bbox");
  } else {
    // Find largest empty-row gap inside content to separate mark (top) from text (bottom)
    let bestGap = 0;
    let gapAt = -1;
    let run = 0;
    let runStart = 0;
    for (let y = minY; y <= maxY; y++) {
      if (rowInk[y] === 0) {
        if (run === 0) runStart = y;
        run++;
        if (run > bestGap) {
          bestGap = run;
          gapAt = runStart + Math.floor(run / 2);
        }
      } else {
        run = 0;
      }
    }
    by1 = minY;
    by2 = gapAt > minY ? gapAt - 1 : Math.floor((minY + maxY) / 2);
    bx1 = minX;
    bx2 = maxX;
    console.log("crop: upper band before gap at", gapAt, "gap", bestGap);
  }

  // Tighten horizontal to blue columns only within vertical range
  let hx1 = w,
    hx2 = 0;
  for (let y = by1; y <= by2; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isBlueMark(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        hx1 = Math.min(hx1, x);
        hx2 = Math.max(hx2, x);
      }
    }
  }
  if (hx2 > hx1) {
    bx1 = hx1;
    bx2 = hx2;
  }

  // Small margin so we don't clip antialias
  const margin = 8;
  bx1 = Math.max(0, bx1 - margin);
  by1 = Math.max(0, by1 - margin);
  bx2 = Math.min(w - 1, bx2 + margin);
  by2 = Math.min(h - 1, by2 + margin);

  const bw = bx2 - bx1 + 1;
  const bh = by2 - by1 + 1;
  console.log("extract", bx1, by1, bw, "x", bh);

  const regionBuf = await sharp(SRC)
    .extract({ left: bx1, top: by1, width: bw, height: bh })
    .png()
    .toBuffer();

  const inner = Math.round(SIZE * (1 - PAD * 2));
  const fitted = await sharp(regionBuf)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  const icon = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: fitted, gravity: "centre" }])
    .png()
    .toBuffer();

  const iconPath = path.join(APP, "icon.png");
  fs.writeFileSync(iconPath, icon);
  console.log("wrote", iconPath, icon.length, "bytes");

  const fav = path.join(APP, "favicon.ico");
  if (fs.existsSync(fav)) {
    fs.unlinkSync(fav);
    console.log("removed", fav);
  }

  const meta = await sharp(iconPath).metadata();
  console.log("icon meta", meta.width, "x", meta.height, meta.format);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
