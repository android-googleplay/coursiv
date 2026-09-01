import { copyFile, mkdir, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/import-google-slide-with-ai-images.mjs <extracted-image-directory>");

const target = join(process.cwd(), "public/images/courses/google-slide-with-ai");
await mkdir(target, { recursive: true });

async function findPngFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findPngFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".png")) files.push(path);
  }
  return files;
}

const files = (await findPngFiles(source)).sort();
if (files.length !== 33) throw new Error(`Expected 33 source images, found ${files.length}`);

for (const path of files) {
  const lessonMatch = path.match(/lesson-(\d{2})-[^/]+/);
  const stepMatch = basename(path).match(/^step-(\d{2})-/);
  if (!lessonMatch || !stepMatch) throw new Error(`Unsupported image path: ${path}`);
  const outputBase = `lesson-${lessonMatch[1]}-step-${stepMatch[1]}`;
  await copyFile(path, join(target, `${outputBase}.png`));
  await sharp(path)
    .avif({ quality: 74, effort: 5 })
    .toFile(join(target, `${outputBase}.avif`));
}

console.log(JSON.stringify({ sourceImages: files.length, outputImages: files.length * 2, target }, null, 2));
