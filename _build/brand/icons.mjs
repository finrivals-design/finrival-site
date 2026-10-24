// Builds the site icons from the full Finrival logo (/logo.png, the white "finrival" wordmark with
// the teal arrow) on the site's dark background, with headless Chrome or Edge. The app's short
// "fin" icon is not used on the web: "fin" alone is too close to other brands.
//
//   node _build/brand/icons.mjs
//
// Writes:
//   /favicon.ico                    16, 32 and 48 px, the file Google and browsers ask for first
//   /apple-touch-icon.png           180 px square for iPhone home screens (iOS rounds it)
//   /assets/img/favicon-96.png      browser tabs, rounded with transparent corners
//   /assets/img/icon-192.png        web manifest and Google, rounded
//   /assets/img/icon-512.png        web manifest, rounded
//   /assets/img/icon-maskable-512.png  Android, full bleed with the logo inside the safe zone
//   /assets/img/logo-square-512.png Organization logo for Google (structured data), full bleed
// Run it again when the logo changes, then commit the files.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const browser = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find(existsSync);
if (!browser) throw new Error("Chrome or Edge is needed to render the icons");

const source = (await readFile(join(root, "logo.png"))).toString("base64");
const profile = await mkdtemp(join(tmpdir(), "finrival-icons-"));
const port = 9500 + Math.floor(Math.random() * 400);
const chrome = spawn(browser, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let tabs;
for (let i = 0; i < 120 && !tabs; i++) {
  try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); }
}
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const evaluate = (expression) => new Promise((resolve) => {
  const i = ++id;
  pending.set(i, (r) => resolve(r?.result?.value));
  ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
});

// The wordmark is cropped to its visible pixels and centred on the site background (#06090d).
// "rounded" is a rounded square with transparent corners (tabs, manifest); "square" fills the
// whole square (iPhone rounds it itself, Google logo); "maskable" keeps the wordmark inside
// Android's circular safe zone.
const render = (size, mode) => evaluate(`(async () => {
  const img = new Image();
  img.src = "data:image/png;base64,${source}";
  await img.decode();
  const probe = document.createElement("canvas");
  probe.width = img.width;
  probe.height = img.height;
  const pg = probe.getContext("2d");
  pg.drawImage(img, 0, 0);
  const px = pg.getImageData(0, 0, img.width, img.height).data;
  let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (px[(y * img.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const c = document.createElement("canvas");
  c.width = c.height = ${size};
  const g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  const s = ${size}, mode = "${mode}";
  if (mode === "rounded") {
    g.beginPath();
    g.roundRect(0, 0, s, s, s * 0.225);
    g.clip();
  }
  g.fillStyle = "#06090d";
  g.fillRect(0, 0, s, s);
  // Small sizes use more of the width so the word stays as large as possible
  const share = mode === "maskable" ? 0.72 : s <= 48 ? 0.94 : 0.84;
  const dw = s * share, dh = dw * h / w;
  g.drawImage(img, x0, y0, w, h, (s - dw) / 2, (s - dh) / 2, dw, dh);
  return c.toDataURL("image/png").split(",")[1];
})()`);

const png = async (size, mode) => Buffer.from(await render(size, mode), "base64");

// ICO with PNG entries, supported by every current browser and by Google
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((x) => x.data)]);
}

const out = {
  "favicon.ico": ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size, "rounded") })))),
  "apple-touch-icon.png": await png(180, "square"),
  "assets/img/favicon-96.png": await png(96, "rounded"),
  "assets/img/icon-192.png": await png(192, "rounded"),
  "assets/img/icon-512.png": await png(512, "rounded"),
  "assets/img/icon-maskable-512.png": await png(512, "maskable"),
  "assets/img/logo-square-512.png": await png(512, "square"),
};
for (const [file, data] of Object.entries(out)) {
  await writeFile(join(root, file), data);
  console.log(`wrote /${file}`);
}

ws.close();
chrome.kill();
await sleep(500);
await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }).catch(() => {});
