#!/usr/bin/env bun

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import bundledMap from "../keymaps/amelie.full.xkb" with { type: "file" };
import { parseKeymap } from "./keymap";
import { renderKeymapHtml, renderKeymapSvg } from "./visualize";

type Scope = "user" | "etc" | "system";
type Target = "cosmic";
type Component = "keycodes" | "types" | "compat" | "symbols";

const profile = "amelie";
const standalone = import.meta.dir.startsWith("/$bunfs/");
const root = standalone
  ? join(tmpdir(), "inputwerk")
  : resolve(import.meta.dir, "..");
const repositorySource = join(root, "keymaps", `${profile}.full.xkb`);
const source = standalone ? bundledMap : repositorySource;
const generated = join(root, "generated", profile);
const cosmicConfig = join(
  process.env.HOME ?? fail("HOME is not set"),
  ".config/cosmic/com.system76.CosmicComp/v1/xkb_config",
);

function fail(message: string): never {
  throw new Error(message);
}

function info(message: string): void {
  console.log(`> ${message}`);
}

function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function assertName(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    fail(`${label} must contain only letters, digits, _ or -: ${value}`);
  }
}

function atomicWrite(path: string, content: string): void {
  ensureDirectory(dirname(path));
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, content, { mode: 0o644 });
  renameSync(temporary, path);
}

function skipQuoted(text: string, index: number): number {
  const quote = text[index];
  for (let cursor = index + 1; cursor < text.length; cursor++) {
    if (text[cursor] === "\\") cursor++;
    else if (text[cursor] === quote) return cursor;
  }
  fail("Unterminated string in XKB source");
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let cursor = open; cursor < text.length; cursor++) {
    const char = text[cursor];
    const next = text[cursor + 1];
    if (char === '"' || char === "'") cursor = skipQuoted(text, cursor);
    else if (char === "/" && next === "/") {
      cursor = text.indexOf("\n", cursor + 2);
      if (cursor === -1) fail("Unterminated XKB section");
    } else if (char === "/" && next === "*") {
      cursor = text.indexOf("*/", cursor + 2);
      if (cursor === -1) fail("Unterminated block comment in XKB source");
      cursor++;
    } else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return cursor;
  }
  fail("Unterminated XKB section");
}

function extract(text: string, sourceKind: string): string {
  const pattern = new RegExp(`\\bxkb_${sourceKind}\\s+"[^"]*"\\s*\\{`, "m");
  const match = pattern.exec(text);
  if (!match) fail(`Missing xkb_${sourceKind} section in ${source}`);
  const open = text.indexOf("{", match.index);
  const close = matchingBrace(text, open);
  const body = text.slice(open + 1, close).trim();
  return `default xkb_${sourceKind} "${profile}" {\n${body}\n};\n`;
}

function rulesFile(): string {
  return [
    "! model = keycodes",
    `  * = ${profile}`,
    "",
    "! model = types",
    `  * = ${profile}`,
    "",
    "! model = compat",
    `  * = ${profile}`,
    "",
    "! model layout = symbols",
    `  *     * = ${profile}`,
    "",
  ].join("\n");
}

function generate(): void {
  if (!existsSync(source)) fail(`Source map is missing: ${source}`);
  const full = readFileSync(source, "utf8");
  if (!/\bxkb_keymap\s*\{/.test(full)) {
    fail(`${source} is not a complete xkb_keymap`);
  }

  const components: Array<[Component, string]> = [
    ["keycodes", extract(full, "keycodes")],
    ["types", extract(full, "types")],
    ["compat", extract(full, "compatibility")],
    ["symbols", extract(full, "symbols")],
  ];
  for (const [kind, content] of components) {
    atomicWrite(join(generated, kind, profile), content);
  }
  atomicWrite(join(generated, "rules", profile), rulesFile());
  info(`Generated ${components.length} components and rules in ${generated}`);
}

async function run(command: string[], sudo = false): Promise<void> {
  const executable = sudo ? ["sudo", ...command] : command;
  const process = Bun.spawn(executable, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await process.exited) !== 0) fail(`Command failed: ${executable.join(" ")}`);
}

async function validate(): Promise<void> {
  generate();
  await run([
    "xkbcli",
    "compile-keymap",
    "--include",
    generated,
    "--include-defaults",
    "--rules",
    profile,
    "--model",
    profile,
    "--layout",
    profile,
    "--test",
  ]);
  info("RMLVO validation passed with libxkbcommon");
}

function installRoot(scope: Scope): string {
  const home = process.env.HOME ?? fail("HOME is not set");
  if (scope === "user") return join(home, ".config/xkb");
  if (scope === "etc") return "/etc/xkb";
  return "/usr/share/X11/xkb";
}

async function installFile(from: string, to: string, sudo: boolean): Promise<void> {
  if (sudo) {
    await run(["install", "-D", "-m", "0644", from, to], true);
  } else {
    ensureDirectory(dirname(to));
    copyFileSync(from, to);
  }
}

function cosmicRon(): string {
  return [
    "(",
    `    rules: "${profile}",`,
    `    model: "${profile}",`,
    `    layout: "${profile}",`,
    '    variant: "",',
    "    options: None,",
    ")",
    "",
  ].join("\n");
}

async function install(target: Target, scope: Scope): Promise<void> {
  if (target !== "cosmic") fail(`Unsupported target: ${target}`);
  await validate();
  const destination = installRoot(scope);
  const sudo = scope !== "user";
  for (const directory of ["keycodes", "types", "compat", "symbols", "rules"]) {
    await installFile(
      join(generated, directory, profile),
      join(destination, directory, profile),
      sudo,
    );
  }

  if (existsSync(cosmicConfig)) {
    const backup = `${cosmicConfig}.bak-${new Date().toISOString().replaceAll(":", "-")}`;
    copyFileSync(cosmicConfig, backup);
    info(`Backed up COSMIC config to ${backup}`);
  }
  atomicWrite(cosmicConfig, cosmicRon());
  info(`Installed XKB components in ${destination}`);
  info(`Wrote COSMIC config ${cosmicConfig}`);
  info("Log out of COSMIC and log back in to restart the compositor");
}

function status(): void {
  const candidates: Scope[] = ["user", "etc", "system"];
  console.log(`source: ${source}`);
  console.log(`source exists: ${existsSync(source)}`);
  console.log(`COSMIC config: ${cosmicConfig}`);
  if (existsSync(cosmicConfig)) {
    console.log(readFileSync(cosmicConfig, "utf8").trim());
  }
  for (const scope of candidates) {
    const path = join(installRoot(scope), "rules", profile);
    const state = existsSync(path) ? `${statSync(path).size} bytes` : "missing";
    console.log(`${scope}: ${path} (${state})`);
  }
}

async function importMap(path: string): Promise<void> {
  if (standalone) {
    fail("import is only available from the recipe checkout, not the standalone binary");
  }
  const input = resolve(path);
  if (!existsSync(input)) fail(`Import source does not exist: ${input}`);
  ensureDirectory(dirname(repositorySource));
  copyFileSync(input, repositorySource);
  info(`Imported ${basename(input)} to ${repositorySource}`);
  await validate();
}

function visualize(
  sourcePath: string | undefined,
  outputPath: string,
  jsonPath?: string,
  svgPath?: string,
  layer = 1,
): void {
  const input = sourcePath ? resolve(sourcePath) : source;
  if (!existsSync(input)) fail(`Visualization source does not exist: ${input}`);
  const keymap = parseKeymap(readFileSync(input, "utf8"), basename(input));
  const output = resolve(outputPath);
  atomicWrite(output, renderKeymapHtml(keymap));
  info(`Rendered ${keymap.levels.length} layers and ${keymap.rows.flatMap((row) => row.keys).length + keymap.extras.length} keys to ${output}`);
  if (jsonPath) {
    const json = resolve(jsonPath);
    atomicWrite(json, `${JSON.stringify(keymap, null, 2)}\n`);
    info(`Wrote reusable keymap data to ${json}`);
  }
  if (svgPath) {
    if (!Number.isInteger(layer) || layer < 1 || layer > keymap.levels.length) {
      fail(`Preview layer must be between 1 and ${keymap.levels.length}`);
    }
    const svg = resolve(svgPath);
    atomicWrite(svg, renderKeymapSvg(keymap, layer - 1));
    info(`Wrote layer ${layer} preview to ${svg}`);
  }
}

function usage(): void {
  console.log(`Usage:
  inputwerk import --source /path/to/full.xkb
  inputwerk generate
  inputwerk validate
  inputwerk visualize [--source map.xkb] [--output keymap.html] [--json keymap.json] [--svg preview.svg] [--layer 1]
  inputwerk install --target cosmic --scope user|etc|system
  inputwerk status`);
}

async function main(): Promise<void> {
  const [, , command = "help", ...args] = Bun.argv;
  if (command === "help" || command === "--help") return usage();
  if (command === "generate") return generate();
  if (command === "validate") return validate();
  if (command === "status") return status();
  if (command === "visualize") {
    return visualize(
      valueAfter(args, "--source"),
      valueAfter(args, "--output") ?? "inputwerk-keymap.html",
      valueAfter(args, "--json"),
      valueAfter(args, "--svg"),
      Number(valueAfter(args, "--layer") ?? "1"),
    );
  }
  if (command === "import") {
    const path = valueAfter(args, "--source") ?? fail("import requires --source");
    return importMap(path);
  }
  if (command === "install") {
    const target = (valueAfter(args, "--target") ?? "cosmic") as Target;
    const scope = (valueAfter(args, "--scope") ?? "user") as Scope;
    assertName(target, "target");
    if (!["user", "etc", "system"].includes(scope)) fail(`Invalid scope: ${scope}`);
    return install(target, scope);
  }
  fail(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `error: ${error.message}` : error);
  process.exit(1);
});
