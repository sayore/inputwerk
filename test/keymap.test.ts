import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { keysymLabel, parseKeymap } from "../src/keymap";

const source = readFileSync(join(import.meta.dir, "../keymaps/amelie.full.xkb"), "utf8");
const keymap = parseKeymap(source);
const keys = [...keymap.rows.flatMap((row) => row.keys), ...keymap.extras];

describe("XKB keymap parser", () => {
  test("uses the assigned XKB type to cap effective levels", () => {
    expect(keymap.levels).toHaveLength(8);
    expect(keymap.levels.map((level) => level.name)).toEqual([
      "Base", "Shift", "AltGr", "Shift AltGr",
      "Caps", "Shift Caps", "Caps AltGr", "Shift Caps AltGr",
    ]);
    expect(keys.find((key) => key.code === "AE01")?.symbols).toHaveLength(8);
    expect(keys.find((key) => key.code === "FK01")?.levelNames[4]).toBe("Ctrl+Alt");
    expect(keys.find((key) => key.code === "FK01")?.labels[4]).toBe("Switch VT 1");
  });

  test("extracts symbols from block and inline key declarations", () => {
    expect(keys.find((key) => key.code === "AB08")?.labels).toEqual([
      ",", ";", "·", "×", "<", "<",
    ]);
    expect(keys.find((key) => key.code === "SPCE")?.labels).toEqual(["Space"]);
  });

  test("renders Unicode keysyms", () => {
    expect(keysymLabel("U1F92D")).toBe("🤭");
    expect(keysymLabel("EuroSign")).toBe("€");
  });
});
