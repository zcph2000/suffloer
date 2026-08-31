# Sufflør

Replik-øve-app til skuespillere. Importér manus (PDF/tekst), vælg din rolle,
øv scene for scene med AI-stemmer på de andre roller.

**Live:** https://zcph2000.github.io/suffloer/

## Byg

Hele appen er én selvstændig fil (`index.html`, ~1,5 MB med pdf.js inlinet).

```
cd build
node build.js
```

- `build/suffloer.src.html` — kilden (rediger denne)
- `build/build.js` — inliner pdf.js og pakker to udgaver:
  - `index.html` i roden → det GitHub Pages serverer
  - `build/suffloer.html` → fragment til Claude-artifact (ikke i git)

Efter build: `git add -A && git commit && git push` — Pages opdaterer selv efter ~1 min.

## AI-stemmer

Google Cloud Text-to-Speech, "bring your own key". Nøglen indtastes i appen
(⚙ AI-stemmer) og gemmes kun i browserens localStorage på enheden.
Lyd caches i IndexedDB, så hver replik kun hentes én gang.
