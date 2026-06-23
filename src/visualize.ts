import componentSource from "./web/inputwerk-keymap.js" with { type: "text" };
import type { KeymapDocument } from "./keymap";

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function renderKeymapHtml(keymap: KeymapDocument): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${keymap.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;")} · inputwerk</title>
  <style>
    html { background: #0a0c10; color: #f5f7fb; }
    body { margin: 0; min-height: 100vh; padding: clamp(16px, 5vw, 72px); }
    main { margin: auto; max-width: 1500px; }
  </style>
</head>
<body>
  <main><inputwerk-keymap id="keymap"></inputwerk-keymap></main>
  <script type="module">
${componentSource}
    document.querySelector("#keymap").data = ${safeJson(keymap)};
  </script>
</body>
</html>
`;
}

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderKeymapSvg(keymap: KeymapDocument, layerIndex = 0): string {
  const unit = 64;
  const gap = 7;
  const rowHeight = 66;
  const header = 92;
  const padding = 24;
  const rowWidth = (row: KeymapDocument["rows"][number]) => row.keys.reduce(
    (width, key) => width + (key.width ?? 1) * unit,
    Math.max(0, row.keys.length - 1) * gap,
  );
  const width = Math.ceil(Math.max(...keymap.rows.map(rowWidth)) + padding * 2);
  const height = header + keymap.rows.length * rowHeight + padding;
  const level = keymap.levels[layerIndex] ?? keymap.levels[0];
  const keys: string[] = [];

  keymap.rows.forEach((row, rowIndex) => {
    let x = padding;
    row.keys.forEach((key) => {
      const keyWidth = (key.width ?? 1) * unit;
      const label = key.labels[layerIndex] ?? "";
      const words = label.includes(" ") ? label.split(" ") : [label];
      const fontSize = label.length > 14 ? 9 : label.length > 8 ? 10 : 14;
      const center = x + keyWidth / 2;
      const y = header + rowIndex * rowHeight;
      keys.push(`<g><rect x="${x}" y="${y}" width="${keyWidth}" height="56" rx="7" fill="#252a34" stroke="#424957"/>`);
      if (words.length > 1) {
        const start = y + 25 - ((words.length - 1) * 6);
        keys.push(`<text x="${center}" y="${start}" text-anchor="middle" fill="#f5f7fb" font-size="${fontSize}" font-weight="650">${words.map((word, index) => `<tspan x="${center}" dy="${index === 0 ? 0 : 12}">${xml(word)}</tspan>`).join("")}</text>`);
      } else {
        keys.push(`<text x="${center}" y="${y + 31}" text-anchor="middle" fill="${label ? "#f5f7fb" : "#596170"}" font-size="${fontSize}" font-weight="650">${xml(label || "·")}</text>`);
      }
      keys.push(`<text x="${x + 5}" y="${y + 50}" fill="#929aab" font-size="7" font-family="monospace">${xml(key.code)}</text></g>`);
      x += keyWidth + gap;
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">${xml(keymap.name)} — layer ${level.index}</title>
  <desc id="description">Static inputwerk keymap preview. Open the linked HTML visualizer to switch layers.</desc>
  <rect width="100%" height="100%" rx="18" fill="#111318"/>
  <text x="${padding}" y="31" fill="#a8ff78" font-size="10" font-family="monospace" letter-spacing="2">INPUTWERK · XKB</text>
  <text x="${padding}" y="60" fill="#f5f7fb" font-size="23" font-family="system-ui,sans-serif" font-weight="700">${xml(keymap.name)}</text>
  <text x="${padding}" y="79" fill="#929aab" font-size="12" font-family="system-ui,sans-serif">Layer ${level.index} · ${xml(level.name)}</text>
  ${keys.join("")}
</svg>\n`;
}
