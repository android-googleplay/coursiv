import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/import-google-sheet-with-ai-images.mjs <extracted-image-directory>");

const target = join(process.cwd(), "public/images/courses/google-sheet-with-ai");
await mkdir(target, { recursive: true });

const files = (await readdir(source))
  .filter((name) => /^Lesson_\d{2}_.+_Step_\d{2}_.+\.png$/.test(name))
  .sort();
if (files.length !== 33) throw new Error(`Expected 33 source images, found ${files.length}`);

for (const name of files) {
  const match = name.match(/^Lesson_(\d{2})_.+_Step_(\d{2})_/);
  if (!match) throw new Error(`Unsupported image name: ${name}`);
  const base = `lesson-${match[1]}-step-${match[2]}`;
  await copyFile(join(source, name), join(target, `${base}.png`));
  await sharp(join(source, name))
    .avif({ quality: 74, effort: 5 })
    .toFile(join(target, `${base}.avif`));
}

console.log(JSON.stringify({ sourceImages: files.length, outputImages: files.length * 2, target }, null, 2));
