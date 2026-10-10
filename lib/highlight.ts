"use client";

import type { HighlighterCore, ThemeRegistrationRaw } from "shiki/core";

// Syntax highlighting with Shiki, loaded lazily so the first paint does not
// pay for grammars. The JavaScript regex engine avoids shipping WASM. Each
// language is imported on first use, so the bundle only grows with what a
// conversation actually shows.

// A dark theme tuned to zot.sh: cyan accent, neutral background, and the
// same syntax hues the site's terminal demo uses.
const zotTheme: ThemeRegistrationRaw = {
  name: "zot",
  type: "dark",
  settings: [
    { settings: { foreground: "#e5e5e5", background: "#00000000" } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#7c8494", fontStyle: "italic" } },
    { scope: ["string", "string.quoted", "string.template", "markup.inline.raw"], settings: { foreground: "#c3e88d" } },
    { scope: ["constant.character.escape", "string.regexp"], settings: { foreground: "#89ddff" } },
    { scope: ["constant.numeric", "constant.language", "constant.other", "support.constant"], settings: { foreground: "#f78c6c" } },
    { scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new", "keyword.operator.expression"], settings: { foreground: "#c792ea" } },
    { scope: ["keyword.operator", "punctuation.separator.key-value"], settings: { foreground: "#89ddff" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call entity.name.function", "variable.function"], settings: { foreground: "#6adaff" } },
    { scope: ["entity.name.type", "entity.name.class", "support.type", "support.class", "entity.other.inherited-class"], settings: { foreground: "#ffcb6b" } },
    { scope: ["variable.parameter"], settings: { foreground: "#f0c674" } },
    { scope: ["variable.other.property", "meta.object-literal.key", "support.type.property-name", "entity.name.tag.yaml"], settings: { foreground: "#82aaff" } },
    { scope: ["entity.name.tag", "punctuation.definition.tag"], settings: { foreground: "#f07178" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#ffcb6b" } },
    { scope: ["punctuation", "meta.brace"], settings: { foreground: "#a8b0bd" } },
    { scope: ["markup.heading", "entity.name.section", "markup.heading punctuation.definition.heading"], settings: { foreground: "#6adaff", fontStyle: "bold" } },
    { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
    { scope: ["markup.underline.link", "string.other.link"], settings: { foreground: "#6adaff" } },
    { scope: ["markup.list punctuation.definition.list.begin"], settings: { foreground: "#6adaff" } },
    { scope: ["markup.inserted", "punctuation.definition.inserted"], settings: { foreground: "#c3e88d" } },
    { scope: ["markup.deleted", "punctuation.definition.deleted"], settings: { foreground: "#f07178" } },
    { scope: ["meta.diff.range", "meta.diff.header"], settings: { foreground: "#82aaff" } },
    { scope: ["invalid"], settings: { foreground: "#ff5370" } },
  ],
};

type LangLoader = () => Promise<unknown>;

// Supported languages. Aliases map to the same loader.
const LANGS: Record<string, LangLoader> = {
  bash: () => import("@shikijs/langs/bash"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  csharp: () => import("@shikijs/langs/csharp"),
  css: () => import("@shikijs/langs/css"),
  dart: () => import("@shikijs/langs/dart"),
  diff: () => import("@shikijs/langs/diff"),
  dockerfile: () => import("@shikijs/langs/dockerfile"),
  elixir: () => import("@shikijs/langs/elixir"),
  go: () => import("@shikijs/langs/go"),
  graphql: () => import("@shikijs/langs/graphql"),
  haskell: () => import("@shikijs/langs/haskell"),
  html: () => import("@shikijs/langs/html"),
  ini: () => import("@shikijs/langs/ini"),
  java: () => import("@shikijs/langs/java"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  jsx: () => import("@shikijs/langs/jsx"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  lua: () => import("@shikijs/langs/lua"),
  makefile: () => import("@shikijs/langs/makefile"),
  markdown: () => import("@shikijs/langs/markdown"),
  nginx: () => import("@shikijs/langs/nginx"),
  nix: () => import("@shikijs/langs/nix"),
  php: () => import("@shikijs/langs/php"),
  powershell: () => import("@shikijs/langs/powershell"),
  prisma: () => import("@shikijs/langs/prisma"),
  proto: () => import("@shikijs/langs/proto"),
  python: () => import("@shikijs/langs/python"),
  ruby: () => import("@shikijs/langs/ruby"),
  rust: () => import("@shikijs/langs/rust"),
  scss: () => import("@shikijs/langs/scss"),
  sql: () => import("@shikijs/langs/sql"),
  svelte: () => import("@shikijs/langs/svelte"),
  swift: () => import("@shikijs/langs/swift"),
  terraform: () => import("@shikijs/langs/terraform"),
  toml: () => import("@shikijs/langs/toml"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  vue: () => import("@shikijs/langs/vue"),
  xml: () => import("@shikijs/langs/xml"),
  yaml: () => import("@shikijs/langs/yaml"),
  zig: () => import("@shikijs/langs/zig"),
};

const ALIASES: Record<string, string> = {
  sh: "bash", shell: "bash", zsh: "bash", console: "bash", shellscript: "bash",
  "c++": "cpp", cc: "cpp", hpp: "cpp", h: "c",
  cs: "csharp",
  docker: "dockerfile",
  ex: "elixir", exs: "elixir",
  golang: "go",
  gql: "graphql",
  hs: "haskell",
  htm: "html", svg: "xml",
  js: "javascript", mjs: "javascript", cjs: "javascript",
  json5: "jsonc",
  kt: "kotlin", kts: "kotlin",
  make: "makefile", mk: "makefile",
  md: "markdown", mdx: "markdown",
  ps1: "powershell", pwsh: "powershell",
  protobuf: "proto",
  py: "python",
  rb: "ruby",
  rs: "rust",
  tf: "terraform", hcl: "terraform",
  ts: "typescript", mts: "typescript", cts: "typescript",
  yml: "yaml",
  patch: "diff",
  conf: "ini", cfg: "ini", env: "ini", dotenv: "ini",
};

// Extensionless file names with a known language.
const FILE_NAMES: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  gnumakefile: "makefile",
  ".env": "ini",
  ".gitignore": "ini",
  "go.mod": "go",
};

export function resolveLang(name: string | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  if (LANGS[n]) return n;
  return ALIASES[n] ?? null;
}

// langFromPath picks a language from a file path, or null.
export function langFromPath(path: string | undefined): string | null {
  if (!path) return null;
  const base = path.split(/[\\/]/).pop()!.toLowerCase();
  if (FILE_NAMES[base]) return FILE_NAMES[base];
  if (base.startsWith(".env")) return "ini";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? resolveLang(base.slice(dot + 1)) : null;
}

let highlighter: Promise<HighlighterCore> | null = null;
const loaded = new Map<string, Promise<void>>();

type RegexEngine = Parameters<typeof import("shiki/core").createHighlighterCore>[0]["engine"];

// The browser uses the JavaScript regex engine (no WASM download). Tests run
// under Bun, whose regex implementation tokenizes some grammars differently,
// so they inject the reference Oniguruma engine instead.
let engineFactory: () => Promise<RegexEngine> = async () => (await import("shiki/engine/javascript")).createJavaScriptRegexEngine();

export function setRegexEngineForTests(factory: () => Promise<RegexEngine>) {
  engineFactory = factory;
  highlighter = null;
  loaded.clear();
  cache.clear();
}

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, engine] = await Promise.all([import("shiki/core"), engineFactory()]);
    return createHighlighterCore({ themes: [zotTheme], langs: [], engine });
  })();
  return highlighter;
}

async function ensureLang(h: HighlighterCore, lang: string) {
  let p = loaded.get(lang);
  if (!p) {
    p = LANGS[lang]().then((mod) => h.loadLanguage((mod as { default: Parameters<HighlighterCore["loadLanguage"]>[0] }).default));
    loaded.set(lang, p);
  }
  await p;
}

// Very large inputs are left plain: tokenizing them would block the UI.
const MAX_HIGHLIGHT_CHARS = 200_000;

const cache = new Map<string, string>();

// highlight returns HTML for code in lang, or null when the language is
// unknown or highlighting is not worth it.
export async function highlight(code: string, lang: string | null): Promise<string | null> {
  if (!lang || !LANGS[lang] || code.length > MAX_HIGHLIGHT_CHARS) return null;
  const key = lang + "\u0000" + code;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const h = await getHighlighter();
  await ensureLang(h, lang);
  const html = h.codeToHtml(code, { lang, theme: "zot" });
  if (cache.size > 200) cache.clear();
  cache.set(key, html);
  return html;
}
