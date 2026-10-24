// Renders the link preview cards to assets/img/og-<lang>.png with headless Chrome or Edge.
//
//   node _build/og/render.mjs
//
// Copy comes from the home hero in _build/i18n/<lang>.json. Run it again when that copy
// or the Market screenshot changes, then rebuild the pages with node _build/build.mjs.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const browser = [
  // Chrome first: headless Edge on Windows can exit without writing the screenshot
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find(existsSync);
if (!browser) throw new Error("Chrome or Edge is needed to render the cards");

const card = await readFile(join(here, "card.html"), "utf8");
const tmp = await mkdtemp(join(tmpdir(), "finrival-og-"));
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

for (const lang of ["en", "tr", "pl"]) {
  const dict = JSON.parse(await readFile(join(here, "..", "i18n", `${lang}.json`), "utf8"));
  const vars = { lang, root: pathToFileURL(root).href, badge: dict.hero.badge, line1: dict.hero.line1, line2: dict.hero.line2 };
  const html = card.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === "root" || k === "lang" ? vars[k] : escape(vars[k])));
  const page = join(tmp, `card-${lang}.html`);
  await writeFile(page, html);
  const out = join(root, "assets", "img", `og-${lang}.png`);
  execFileSync(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--allow-file-access-from-files", "--window-size=1200,630", "--virtual-time-budget=3000",
    `--user-data-dir=${join(tmp, "profile")}`, `--screenshot=${out}`, pathToFileURL(page).href,
  ], { stdio: "pipe" });
  console.log(`rendered assets/img/og-${lang}.png`);
}
// The browser can hold its profile lock for a moment after exiting
await rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }).catch(() => {});
