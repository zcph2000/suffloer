const fs = require("fs");
const DIR = __dirname;

let html = fs.readFileSync(DIR + "/suffloer.src.html", "utf8");

/* 1. Replace hand-rolled PDF section (section 4) with pdf.js-based extractPdf */
const startMark = "/* ---------------------------------------------------------------\n   4. Best-effort PDF text extraction";
const endMark = "/* ---------------------------------------------------------------\n   5. Speech";
const s = html.indexOf(startMark);
const e = html.indexOf(endMark);
if (s < 0 || e < 0) { console.error("markers not found", s, e); process.exit(1); }

const newSection = `/* ---------------------------------------------------------------
   4. PDF text extraction — via bundled pdf.js (runs on main thread)
   --------------------------------------------------------------- */
async function extractPdf(arrayBuffer) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF-læseren blev ikke indlæst");
  try { pdfjsLib.GlobalWorkerOptions.workerSrc = ""; } catch (e) {}

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;

  const rows = [];
  let maxX = 1;
  const pages = Math.min(pdf.numPages, 300);
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();

    // (a) group text runs into visual lines
    const lns = [];
    let li = [], lastY = null;
    const flush = () => {
      if (!li.length) return;
      li.sort((a, b) => a.x - b.x);
      const text = li.map(i => i.s).join("").replace(/\\s+/g, " ").trim();
      lns.push({ text, x: li[0].x, y: li[0].y });
      li = [];
    };
    for (const it of tc.items) {
      if (typeof it.str !== "string") continue;
      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      const x = tr[4], y = tr[5];
      if (lastY == null) lastY = y;
      if (Math.abs(y - lastY) > 2.5) { flush(); lastY = y; }
      if (it.str.trim() || li.length) li.push({ x, s: it.str, y });
      if (it.hasEOL) { flush(); lastY = null; }
    }
    flush();

    // (b) typical single-line spacing on this page → relative paragraph-gap threshold
    const deltas = [];
    for (let i = 1; i < lns.length; i++) {
      const d = lns[i - 1].y - lns[i].y;
      if (d > 1 && d < 120) deltas.push(d);
    }
    deltas.sort((a, b) => a - b);
    const lead = deltas.length ? deltas[Math.floor(deltas.length * 0.35)] : 14;
    const gapAt = lead * 1.7 + 2;

    // (c) emit rows, marking only real paragraph gaps
    for (let i = 0; i < lns.length; i++) {
      const ln = lns[i];
      if (!ln.text) continue;
      if (i > 0 && (lns[i - 1].y - ln.y) > gapAt) rows.push({ text: "", x: 0, gap: true });
      rows.push({ text: ln.text, x: ln.x, gap: false });
      if (ln.x > maxX) maxX = ln.x;
    }
    rows.push({ text: "", x: 0, gap: true });   // page break
    try { page.cleanup(); } catch (e) {}
  }
  try { await pdf.destroy(); } catch (e) {}

  rows.forEach(r => { r.nx = (r.x || 0) / (maxX || 1); });
  const alpha = rows.map(r => r.text).join(" ").replace(/[^A-Za-zÀ-ÿÆØÅæøå]/g, "").length;
  if (alpha < 25) throw new Error("Ingen læsbar tekst i PDF'en – den er sandsynligvis scannet");
  return rows;
}

`;

html = html.slice(0, s) + newSection + html.slice(e);

/* 2. Inline pdf.js just before the app markup */
const lib = fs.readFileSync(DIR + "/pdf.min.js", "utf8");
const worker = fs.readFileSync(DIR + "/pdf.worker.min.js", "utf8");
if (lib.includes("</script") || worker.includes("</script")) { console.error("script close in bundle"); process.exit(1); }

const inject = `<script>/* pdf.js ${lib.length}B */\n${lib}\n</script>\n<script>/* pdf.worker.js ${worker.length}B */\n${worker}\n</script>\n`;
const anchor = '<div class="app">';
const ai = html.indexOf(anchor);
if (ai < 0) { console.error("app anchor not found"); process.exit(1); }
html = html.slice(0, ai) + inject + html.slice(ai);

fs.writeFileSync(DIR + "/suffloer.html", html);
console.log("built suffloer.html", (html.length / 1024).toFixed(0) + "KB");

/* 3. Standalone document for self-hosting (GitHub Pages etc.) */
const bodyHtml = html.replace(/^<title>[^<]*<\/title>\s*/, "");
const standalone = `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Sufflør">
<meta name="theme-color" content="#141318">
<title>Sufflør</title>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
fs.writeFileSync(DIR + "/index.html", standalone);
console.log("built index.html    ", (standalone.length / 1024).toFixed(0) + "KB  (self-hosting)");
