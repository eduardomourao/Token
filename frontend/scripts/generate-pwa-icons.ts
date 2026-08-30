import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(scriptDirectory, "../public");
const faviconPath = path.join(publicDirectory, "favicon.svg");

async function createIcon(size: number, filename: string) {
  const favicon = await readFile(faviconPath, "utf8");
  const whiteLogo = Buffer.from(favicon.replace("path { stroke: #000; }", "path { stroke: #fff; }"));
  const logo = await sharp(whiteLogo)
    .resize(Math.round(size * 0.62), Math.round(size * 0.62), { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#09090b",
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(publicDirectory, filename));
}

await Promise.all([
  createIcon(192, "pwa-192x192.png"),
  createIcon(512, "pwa-512x512.png"),
  createIcon(180, "apple-touch-icon.png"),
]);
