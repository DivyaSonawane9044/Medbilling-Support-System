// Renders public/favicon.svg to PNGs and packs a multi-size favicon.ico (PNG-in-ICO).
import { chromium } from "@playwright/test";
import fs from "node:fs";
const svg = fs.readFileSync("public/favicon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (size) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
};
const icoSizes = [16, 32, 48, 64];
const pngs = [];
for (const s of icoSizes) pngs.push(await render(s));
fs.writeFileSync("public/apple-touch-icon.png", await render(180));
fs.writeFileSync("public/icon-192.png", await render(192));
fs.writeFileSync("public/icon-512.png", await render(512));
await browser.close();
// ICO: 6-byte header, 16-byte entry per image, then PNG data
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16); const s = icoSizes[i];
  e.writeUInt8(s >= 256 ? 0 : s, 0); e.writeUInt8(s >= 256 ? 0 : s, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
  offset += png.length; return e;
});
fs.writeFileSync("public/favicon.ico", Buffer.concat([header, ...entries, ...pngs]));
console.log("favicon.ico", fs.statSync("public/favicon.ico").size, "bytes; png sizes", icoSizes.join(","), "+180,192,512");
