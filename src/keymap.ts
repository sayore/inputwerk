export interface KeymapLevel {
  index: number;
  name: string;
}

export interface KeymapKey {
  code: string;
  type: string | null;
  symbols: string[];
  labels: string[];
  levelNames: string[];
  width?: number;
}

export interface KeymapRow {
  keys: KeymapKey[];
}

export interface KeymapDocument {
  format: "inputwerk/keymap-v1";
  name: string;
  levels: KeymapLevel[];
  rows: KeymapRow[];
  extras: KeymapKey[];
}

interface PhysicalKey {
  code: string;
  width?: number;
}

const physicalRows: PhysicalKey[][] = [
  [
    { code: "ESC" },
    { code: "FK01" }, { code: "FK02" }, { code: "FK03" }, { code: "FK04" },
    { code: "FK05" }, { code: "FK06" }, { code: "FK07" }, { code: "FK08" },
    { code: "FK09" }, { code: "FK10" }, { code: "FK11" }, { code: "FK12" },
  ],
  [
    { code: "TLDE" },
    ...Array.from({ length: 12 }, (_, index) => ({ code: `AE${String(index + 1).padStart(2, "0")}` })),
    { code: "BKSP", width: 2 },
  ],
  [
    { code: "TAB", width: 1.5 },
    ...Array.from({ length: 12 }, (_, index) => ({ code: `AD${String(index + 1).padStart(2, "0")}` })),
    { code: "BKSL", width: 1.5 },
  ],
  [
    { code: "CAPS", width: 1.8 },
    ...Array.from({ length: 11 }, (_, index) => ({ code: `AC${String(index + 1).padStart(2, "0")}` })),
    { code: "RTRN", width: 2.2 },
  ],
  [
    { code: "LFSH", width: 1.4 }, { code: "LSGT" },
    ...Array.from({ length: 10 }, (_, index) => ({ code: `AB${String(index + 1).padStart(2, "0")}` })),
    { code: "RTSH", width: 2.6 },
  ],
  [
    { code: "LCTL", width: 1.4 }, { code: "LWIN", width: 1.2 },
    { code: "LALT", width: 1.2 }, { code: "SPCE", width: 6.2 },
    { code: "RALT", width: 1.2 }, { code: "RWIN", width: 1.2 },
    { code: "COMP", width: 1.2 }, { code: "RCTL", width: 1.4 },
  ],
];

const symbolLabels: Record<string, string> = {
  NoSymbol: "",
  space: "Space",
  Escape: "Esc",
  BackSpace: "Backspace",
  Tab: "Tab",
  ISO_Left_Tab: "⇤",
  Return: "Enter",
  Shift_L: "Shift",
  Shift_R: "Shift",
  Control_L: "Ctrl",
  Control_R: "Ctrl",
  Alt_L: "Alt",
  Alt_R: "Alt",
  Super_L: "Super",
  Super_R: "Super",
  Menu: "Menu",
  ISO_Level3_Shift: "Level 3",
  ISO_Level5_Shift: "Level 5",
  exclam: "!", quotedbl: "\"", section: "§", dollar: "$", percent: "%",
  ampersand: "&", slash: "/", parenleft: "(", parenright: ")", equal: "=",
  question: "?", questiondown: "¿", backslash: "\\", acute: "´", grave: "`",
  at: "@", sterling: "£", EuroSign: "€", paragraph: "¶", registered: "®",
  trademark: "™", yen: "¥", braceleft: "{", braceright: "}",
  bracketleft: "[", bracketright: "]", plusminus: "±", onequarter: "¼",
  onehalf: "½", oneeighth: "⅛", threeeighths: "⅜", currency: "¤",
  semicolon: ";", colon: ":", apostrophe: "'", asciicircum: "^",
  asciitilde: "~", asterisk: "*", numbersign: "#", bar: "|", minus: "−",
  plus: "+", underscore: "_", comma: ",", period: ".", less: "<",
  greater: ">", periodcentered: "·", multiply: "×", division: "÷",
  endash: "–", emdash: "—", degree: "°", notsign: "¬", dagger: "†",
  guillemotleft: "«", U2039: "‹", doublelowquotemark: "„",
  singlelowquotemark: "‚", leftdoublequotemark: "“", leftsinglequotemark: "‘",
  rightsinglequotemark: "’", masculine: "º", ordfeminine: "ª", mu: "µ",
  downarrow: "↓", uparrow: "↑", leftarrow: "←", rightarrow: "→",
  oslash: "ø", Oslash: "Ø", thorn: "þ", THORN: "Þ", eth: "ð", ETH: "Ð",
  adiaeresis: "ä", Adiaeresis: "Ä", odiaeresis: "ö", Odiaeresis: "Ö",
  udiaeresis: "ü", Udiaeresis: "Ü", ssharp: "ß", Greek_OMEGA: "Ω",
  idotless: "ı", diaeresis: "¨", macron: "¯", cedilla: "¸",
};

function skipQuoted(text: string, index: number): number {
  const quote = text[index];
  for (let cursor = index + 1; cursor < text.length; cursor++) {
    if (text[cursor] === "\\") cursor++;
    else if (text[cursor] === quote) return cursor;
  }
  throw new Error("Unterminated quoted string in XKB source");
}

function matching(text: string, open: number, opening: string, closing: string): number {
  let depth = 0;
  for (let cursor = open; cursor < text.length; cursor++) {
    const char = text[cursor];
    const next = text[cursor + 1];
    if (char === '"' || char === "'") cursor = skipQuoted(text, cursor);
    else if (char === "/" && next === "/") {
      const end = text.indexOf("\n", cursor + 2);
      if (end === -1) return text.length - 1;
      cursor = end;
    } else if (char === "/" && next === "*") {
      const end = text.indexOf("*/", cursor + 2);
      if (end === -1) throw new Error("Unterminated block comment in XKB source");
      cursor = end + 1;
    } else if (char === opening) depth++;
    else if (char === closing && --depth === 0) return cursor;
  }
  throw new Error(`Unterminated ${opening}${closing} block in XKB source`);
}

function section(text: string, kind: string): string {
  const match = new RegExp(`\\bxkb_${kind}\\s+"[^"]*"\\s*\\{`, "m").exec(text);
  if (!match) throw new Error(`Missing xkb_${kind} section`);
  const open = text.indexOf("{", match.index);
  return text.slice(open + 1, matching(text, open, "{", "}"));
}

function removeComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

function parseTypes(text: string): Map<string, string[]> {
  const types = new Map<string, string[]>();
  const body = section(text, "types");
  const pattern = /\btype\s+"([^"]+)"\s*\{/g;
  for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
    const open = body.indexOf("{", match.index);
    const close = matching(body, open, "{", "}");
    const typeBody = removeComments(body.slice(open + 1, close));
    const levels = new Map<number, string>();
    const levelPattern = /level_name\s*\[\s*Level(\d+)\s*\]\s*=\s*"([^"]+)"/g;
    for (let level = levelPattern.exec(typeBody); level; level = levelPattern.exec(typeBody)) {
      levels.set(Number(level[1]), level[2]);
    }
    const maximum = Math.max(0, ...levels.keys());
    types.set(match[1], Array.from({ length: maximum }, (_, index) => levels.get(index + 1) ?? `Level ${index + 1}`));
    pattern.lastIndex = close + 1;
  }
  return types;
}

function splitSymbols(body: string): string[] {
  return removeComments(body)
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
}

export function keysymLabel(symbol: string): string {
  if (symbolLabels[symbol] !== undefined) return symbolLabels[symbol];
  if (/^U[0-9A-Fa-f]{4,8}$/.test(symbol)) {
    try {
      return String.fromCodePoint(Number.parseInt(symbol.slice(1), 16));
    } catch {
      return symbol;
    }
  }
  if (/^[a-zA-Z0-9]$/.test(symbol)) return symbol;
  if (/^F\d+$/.test(symbol)) return symbol;
  if (symbol.startsWith("KP_")) return symbol.slice(3).replaceAll("_", " ");
  if (symbol.startsWith("XF86")) return symbol.slice(4).replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return symbol.replaceAll("_", " ");
}

function parseKeys(text: string, types: Map<string, string[]>): Map<string, KeymapKey> {
  const keys = new Map<string, KeymapKey>();
  const body = section(text, "symbols");
  const pattern = /\bkey\s+<([^>]+)>\s*\{/g;
  for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
    const open = body.indexOf("{", match.index);
    const close = matching(body, open, "{", "}");
    const keyBody = removeComments(body.slice(open + 1, close));
    const type = /\btype(?:\s*\[\s*Group1\s*\])?\s*=\s*"([^"]+)"/.exec(keyBody)?.[1] ?? null;
    const symbolsAssignment = /symbols\s*\[\s*Group1\s*\]\s*=\s*\[/.exec(keyBody);
    const bracket = symbolsAssignment
      ? symbolsAssignment.index + symbolsAssignment[0].lastIndexOf("[")
      : keyBody.indexOf("[");
    if (bracket === -1) {
      pattern.lastIndex = close + 1;
      continue;
    }
    const symbols = splitSymbols(keyBody.slice(bracket + 1, matching(keyBody, bracket, "[", "]")));
    const typeLevels = type ? types.get(type) : undefined;
    const effectiveSymbols = typeLevels?.length ? symbols.slice(0, typeLevels.length) : symbols;
    keys.set(match[1], {
      code: match[1],
      type,
      symbols: effectiveSymbols,
      labels: effectiveSymbols.map(keysymLabel),
      levelNames: typeLevels?.slice(0, effectiveSymbols.length)
        ?? effectiveSymbols.map((_, index) => ["Base", "Shift", "AltGr", "Shift AltGr"][index] ?? `Level ${index + 1}`),
    });
    pattern.lastIndex = close + 1;
  }
  return keys;
}

export function parseKeymap(text: string, fallbackName = "XKB keymap"): KeymapDocument {
  if (!/\bxkb_keymap\s*\{/.test(text)) throw new Error("Input is not a complete xkb_keymap");
  const types = parseTypes(text);
  const keys = parseKeys(text, types);
  const maximum = Math.max(1, ...Array.from(keys.values(), (key) => key.symbols.length));
  const usage = new Map<string, number>();
  for (const key of keys.values()) {
    if (key.type) usage.set(key.type, (usage.get(key.type) ?? 0) + 1);
  }
  const layerType = Array.from(types.entries())
    .filter(([, typeLevels]) => typeLevels.length === maximum)
    .sort(([left], [right]) => (usage.get(right) ?? 0) - (usage.get(left) ?? 0))[0]?.[1];
  const levels = Array.from({ length: maximum }, (_, index) => ({
    index: index + 1,
    name: layerType?.[index] ?? ["Base", "Shift", "AltGr", "Shift AltGr"][index] ?? `Level ${index + 1}`,
  }));
  const symbolsBody = section(text, "symbols");
  const name = /name\s*\[\s*group1\s*\]\s*=\s*"([^"]+)"/i.exec(symbolsBody)?.[1] ?? fallbackName;
  const used = new Set<string>();
  const rows = physicalRows.map((row) => ({
    keys: row.flatMap(({ code, width }) => {
      const key = keys.get(code);
      if (!key) return [];
      used.add(code);
      return [{ ...key, width }];
    }),
  }));
  const extras = Array.from(keys.values()).filter((key) => !used.has(key.code));
  return { format: "inputwerk/keymap-v1", name, levels, rows, extras };
}
