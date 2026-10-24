# finrival-site

Marketing site for Finrival, published to https://finrival.com with GitHub Pages.

## Languages

Every page is available in English (`/…`), Turkish (`/tr/…`) and Polish (`/pl/…`):
home, Product, Finrival AI, PRO, Support, Privacy Policy, Terms of Use and Delete Account.
These pages are generated, so do not edit their `index.html` files by hand.

- Page layouts: `_build/templates/` (legal pages share `legal.html`)
- Copy: `_build/i18n/en.json`, `tr.json`, `pl.json`
- Legal texts: `_build/content/{en,tr,pl}/{privacy,terms,delete}.html`

After changing any of these, rebuild and commit the generated files:

```bash
node _build/build.mjs
```

The build stops if a translation key is missing in any language or if a text ends with a period.
Folders starting with `_` are not published by GitHub Pages.
`/features/` and `/company/` only redirect to Product and Support.

## Shared assets

- `assets/css/site.css` and `assets/js/site.js`: design system and behaviour for the redesigned pages
- `assets/screens/`: real app screenshots per language (`market-en.webp`, `market-tr.webp`, …)
- Icons (tab, Google, home screen): generated from the full logo `logo.png` with `node _build/brand/icons.mjs`
- Link preview images: `node _build/og/render.mjs`
