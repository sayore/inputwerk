import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseKeymap } from "../src/keymap";
import { renderKeymapHtml, renderKeymapSvg } from "../src/visualize";

const source = readFileSync(join(import.meta.dir, "../keymaps/amelie.full.xkb"), "utf8");
const keymap = parseKeymap(source);

describe("keymap visualizer", () => {
  test("embeds readable switch-VT labels and the key inspector", () => {
    const html = renderKeymapHtml(keymap);
    expect(html).toContain('class="inspector"');
    expect(html).toContain('"Switch VT 10"');
    expect(html).toContain('"Ctrl+Alt"');
    expect(html).not.toContain("text-overflow: ellipsis");
  });

  test("renders a complete layer-five SVG preview", () => {
    const svg = renderKeymapSvg(keymap, 4);
    expect(svg).toContain("Layer 5 · Caps");
    expect(svg).toContain("Switch");
    expect(svg).toContain("VT");
    expect(svg).toContain("12");
  });
});
