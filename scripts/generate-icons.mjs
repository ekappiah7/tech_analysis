/**
 * Generates the PWA icon set from public/favicon.svg.
 *
 * Two variants are needed. The plain icon is used where the platform draws the
 * artwork as-is, and the maskable one adds ~20% padding so Android can crop it
 * to whatever shape the launcher uses without clipping the candles.
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "public/favicon.svg");
const outDir = resolve(root, "public/icons");

mkdirSync(outDir, { recursive: true });

const BACKGROUND = { r: 11, g: 14, b: 20, alpha: 1 };

async function plain(size) {
  const file = resolve(outDir, `icon-${size}.png`);
  await sharp(source, { density: 384 })
    .resize(size, size, { fit: "contain", background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png()
    .toFile(file);
  return file;
}

async function maskable(size) {
  const file = resolve(outDir, `maskable-${size}.png`);
  const inner = Math.round(size * 0.6);
  const art = await sharp(source, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: { ...BACKGROUND, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(file);
  return file;
}

const written = await Promise.all([
  plain(192),
  plain(512),
  plain(180),
  maskable(512),
]);

for (const file of written) console.log(`Wrote ${file}`);
