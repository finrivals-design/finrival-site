// Renders _video/ad.html to an MP4 frame by frame with headless Chrome, so every frame
// is exact no matter how fast the computer is.
//
//   node _video/music.mjs                            -> _video/music.wav (original soundtrack)
//   node _video/render.mjs                           -> finrival-ad-pl.mp4, -en.mp4 and -tr.mp4
//   node _video/render.mjs --lang en                 -> only _video/finrival-ad-en.mp4
//   node _video/render.mjs --lang tr --stills 1.5,4.8 -> PNG stills at those seconds (for checking)
// Every MP4 uses music.wav when it exists.
//
// Needs puppeteer-core and ffmpeg-static. Install them outside the site, for example
//   npm i --prefix ../video-tools puppeteer-core ffmpeg-static
// then point REC_TOOLS at that folder (defaults to _video/ itself).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tools = process.env.REC_TOOLS || here;
const require = createRequire(join(tools, "package.json"));
const puppeteer = require("puppeteer-core");
const ffmpeg = require("ffmpeg-static");

const FPS = 30;
const DURATION = 15;
const W = 1920;
const H = 1080;

const browserPath = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find(existsSync);
if (!browserPath) throw new Error("Chrome or Edge is needed to render the video");

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const stills = arg("--stills")?.split(",").map(Number) ?? null;
const langs = arg("--lang") ? [arg("--lang")] : ["pl", "en", "tr"];

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  args: ["--force-color-profile=srgb", "--hide-scrollbars", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

for (const lang of langs) {
await page.goto(`${pathToFileURL(join(here, "ad.html")).href}?lang=${lang}`, { waitUntil: "networkidle0" });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
});

const seek = (ms) =>
  page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t;
    }
  }, ms);

if (stills) {
  for (const s of stills) {
    await seek(s * 1000);
    const path = join(here, `still-${lang}-${String(s).replace(".", "_")}s.png`);
    await page.screenshot({ path });
    console.log(path);
  }
} else {
  const out = join(here, `finrival-ad-${lang}.mp4`);
  // Soundtrack from music.mjs when present, otherwise a silent track
  // (some ad tools reject videos with no audio stream at all)
  const music = join(here, "music.wav");
  const audioIn = existsSync(music)
    ? ["-i", music]
    : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"];
  const audioFx = existsSync(music) ? ["-af", "highpass=f=30,loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000"] : [];
  const enc = spawn(ffmpeg, [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    ...audioIn,
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p",
    ...audioFx,
    "-c:a", "aac", "-b:a", "192k", "-shortest",
    "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => enc.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));

  const total = FPS * DURATION;
  for (let i = 0; i < total; i++) {
    await seek((i * 1000) / FPS);
    const buf = await page.screenshot({ type: "png" });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r));
    if (i % 30 === 0) process.stdout.write(`\r${Math.round((i / total) * 100)}%`);
  }
  enc.stdin.end();
  await done;
  console.log(`\r100%\n${out}`);
}
}

await browser.close();
