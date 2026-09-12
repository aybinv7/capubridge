import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Regenerates the WebP derivatives the site actually ships.
 *
 * The sources are ~1920px PNGs that get displayed between 340px and 1100px
 * wide. Serving them intact costs both the download and, worse on a phone, a
 * full-size decode into memory for every frame on the page.
 *
 * Run with `node scripts/build-images.mjs` after adding or replacing a
 * capture; the outputs are committed so a normal build stays free of an
 * image pipeline.
 */
/** Captures render between ~340px and ~1100px wide; the mark renders at 24px. */
const WIDTHS = [480, 960, 1440];
const MARK_WIDTHS = [32, 64, 128];
const QUALITY = 78;

const widthsFor = (stem) => (stem === "icon" ? MARK_WIDTHS : WIDTHS);

/**
 * Sources live outside `public/` so the ~4MiB of original PNG is never copied
 * into the deployed bundle; only the derivatives below are served.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = join(root, "assets-src");
const publicDir = join(root, "public");

const isSource = (file) => extname(file).toLowerCase() === ".png";

async function derive(file, inDir, outDir) {
  const source = join(inDir, file);
  const stem = basename(file, extname(file));
  const image = sharp(source);
  const { width: nativeWidth } = await image.metadata();
  const written = [];

  for (const width of widthsFor(stem)) {
    if (width > nativeWidth) continue;
    const out = join(outDir, `${stem}-${width}.webp`);
    await sharp(source).resize({ width }).webp({ quality: QUALITY, effort: 6 }).toFile(out);
    written.push({ width, out, bytes: (await stat(out)).size });
  }

  return { stem, before: (await stat(source)).size, written };
}

async function run() {
  const targets = [
    { in: sourceDir, out: publicDir },
    { in: join(sourceDir, "screenshots"), out: join(publicDir, "screenshots") },
  ];

  let before = 0;
  let after = 0;

  for (const target of targets) {
    for (const file of (await readdir(target.in)).filter(isSource)) {
      const result = await derive(file, target.in, target.out);
      before += result.before;
      after += result.written.reduce((sum, entry) => sum + entry.bytes, 0);
      console.log(
        `${result.stem}: ${(result.before / 1024).toFixed(0)}KiB -> ${result.written
          .map((entry) => `${entry.width}w ${(entry.bytes / 1024).toFixed(0)}KiB`)
          .join(", ")}`,
      );
    }
  }

  console.log(
    `\ntotal: ${(before / 1024).toFixed(0)}KiB of PNG -> ${(after / 1024).toFixed(0)}KiB of WebP across all widths`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
