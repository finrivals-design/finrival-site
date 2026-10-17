// Builds the localized static pages from _build/templates + _build/i18n.
//
//   node _build/build.mjs
//
// English is served at the site root, Turkish at /tr/ and Polish at /pl/.
// Template syntax:
//   {{>name}}        shared markup from _build/partials/name.html
//   {{@current:/path/}}  aria-current="page" on the link to the page being built
//   {{section.key}}  text from _build/i18n/<lang>.json (may contain inline HTML)
//   {{@lang}} {{@locale}} {{@home}} {{@canonical}} {{@s}}  per-language values
//   {{@alternates}} {{@langMenu}} {{@langRow}}             generated markup
//   {{@link:/path/}}  localized URL when that page is built for the language, else the English one
//   {{@content}} {{@toc}} {{doc.key}}  legal documents: body, contents list, copy from "legal.<doc>"
// Legal text in _build/content keeps normal punctuation; the no-period rule only covers site copy.
// The build fails on a missing translation key, so all three languages stay complete.
// Folders starting with "_" are not published by GitHub Pages (Jekyll), so this stays private.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const SITE = "https://finrival.com";

const LANGS = {
  en: { prefix: "", locale: "en_US", code: "EN", name: "English" },
  tr: { prefix: "/tr", locale: "tr_TR", code: "TR", name: "Türkçe" },
  pl: { prefix: "/pl", locale: "pl_PL", code: "PL", name: "Polski" },
};

// Pages that exist in every language. Add a page here once its template is localized.
const PAGES = [
  { path: "/", template: "home.html" },
  { path: "/product/", template: "product.html" },
  { path: "/ai/", template: "ai.html" },
  { path: "/pro/", template: "pro.html" },
  { path: "/support/", template: "support.html" },
  // Legal documents: text in _build/content/<lang>/<doc>.html, page copy under "legal.<doc>"
  { path: "/privacy/", template: "legal.html", doc: "privacy" },
  { path: "/terms/", template: "legal.html", doc: "terms" },
  { path: "/delete-account/", template: "legal.html", doc: "delete" },
];

const localized = new Set(PAGES.map((p) => p.path));
const urlFor = (lang, path) => (localized.has(path) ? LANGS[lang].prefix + path : path);

function lookup(dict, key, lang) {
  const value = key.split(".").reduce((node, part) => (node == null ? node : node[part]), dict);
  if (typeof value !== "string") throw new Error(`Missing "${key}" in ${lang}.json`);
  // House style: no sentence-final periods in site copy. "aiChat" is exempt: it quotes the
  // app's own chat word for word, punctuation included.
  if (!key.startsWith("aiChat.") && /\.\s*$/.test(value)) throw new Error(`"${key}" in ${lang}.json ends with a period`);
  return value;
}

function langLinks(path, current, indent) {
  return Object.entries(LANGS)
    .map(([lang, meta]) => {
      const active = lang === current ? ' aria-current="true"' : "";
      return `${indent}<a href="${urlFor(lang, path)}" hreflang="${lang}" lang="${lang}" data-lang-pick="${lang}"${active}>${meta.name}</a>`;
    });
}

// "On this page" list built from the document's <h2 id="..."> headings
function tocFor(content) {
  return [...content.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)]
    .map(([, id, title]) => `              <li><a href="#${id}">${title.replace(/<[^>]+>/g, "").trim()}</a></li>`)
    .join("\n");
}

function render(template, lang, dict, page, content = "") {
  const meta = LANGS[lang];
  const vars = {
    lang,
    locale: meta.locale,
    home: urlFor(lang, "/"),
    canonical: SITE + urlFor(lang, page.path),
    s: lang,
    langCode: meta.code,
    langName: meta.name,
    alternates: [
      ...Object.keys(LANGS).map((l) => `  <link rel="alternate" hreflang="${l}" href="${SITE + urlFor(l, page.path)}">`),
      `  <link rel="alternate" hreflang="x-default" href="${SITE + page.path}">`,
    ].join("\n"),
    langMenu: langLinks(page.path, lang, "")
      .map((a) => `            <li>${a.replace("</a>", '<svg class="ic"><use href="#i-tick"/></svg></a>')}</li>`)
      .join("\n"),
    langRow: langLinks(page.path, lang, "        ").join("\n"),
    toc: tocFor(content),
  };

  // Document text goes in first so its {{@link:...}} tokens are localized too
  const source = template.replace("{{@content}}", content);
  return source.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, token) => {
    if (token.startsWith("@link:")) return urlFor(lang, token.slice(6));
    if (token.startsWith("@current:")) return token.slice(9) === page.path ? ' aria-current="page"' : "";
    if (token.startsWith("@")) {
      const value = vars[token.slice(1)];
      if (value === undefined) throw new Error(`Unknown build variable ${token}`);
      return value;
    }
    if (token.startsWith("doc.")) return lookup(dict, `legal.${page.doc}.${token.slice(4)}`, lang);
    return lookup(dict, token, lang);
  });
}

const dicts = Object.fromEntries(
  await Promise.all(
    Object.keys(LANGS).map(async (lang) => [lang, JSON.parse(await readFile(join(here, "i18n", `${lang}.json`), "utf8"))])
  )
);

// {{>name}} pulls in _build/partials/name.html (shared header, footer, icon sprite)
async function loadTemplate(file) {
  const source = await readFile(join(here, "templates", file), "utf8");
  const names = [...new Set([...source.matchAll(/\{\{>\s*([\w-]+)\s*\}\}\n?/g)].map((m) => m[1]))];
  const parts = Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await readFile(join(here, "partials", `${n}.html`), "utf8")]))
  );
  return source.replace(/\{\{>\s*([\w-]+)\s*\}\}\n?/g, (_, n) => parts[n]);
}

for (const page of PAGES) {
  const template = await loadTemplate(page.template);
  for (const lang of Object.keys(LANGS)) {
    const content = page.doc ? await readFile(join(here, "content", lang, `${page.doc}.html`), "utf8") : "";
    const html = render(template, lang, dicts[lang], page, content).replace(
      "<!DOCTYPE html>",
      `<!DOCTYPE html>\n<!-- Generated by _build/build.mjs from _build/templates/${page.template} and _build/i18n/${lang}.json. Edit those, not this file. -->`
    );
    const out = join(root, urlFor(lang, page.path), "index.html");
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html);
    console.log(`built ${urlFor(lang, page.path)}index.html`);
  }
}
