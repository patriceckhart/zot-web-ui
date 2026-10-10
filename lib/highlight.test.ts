import { beforeAll, describe, expect, test } from "bun:test";
import { highlight, langFromPath, resolveLang, setRegexEngineForTests } from "./highlight";

beforeAll(() => {
  setRegexEngineForTests(async () => {
    const { createOnigurumaEngine } = await import("shiki/engine/oniguruma");
    return createOnigurumaEngine(import("shiki/wasm"));
  });
});
import { snippetAround } from "./use-search";

describe("language detection", () => {
  test("fence labels and aliases", () => {
    expect(resolveLang("ts")).toBe("typescript");
    expect(resolveLang("Go")).toBe("go");
    expect(resolveLang("sh")).toBe("bash");
    expect(resolveLang("brainfuck")).toBeNull();
    expect(resolveLang(undefined)).toBeNull();
  });
  test("file paths", () => {
    expect(langFromPath("/Users/pat/Desktop/foo.md")).toBe("markdown");
    expect(langFromPath("src/app.tsx")).toBe("tsx");
    expect(langFromPath("C:\\code\\main.rs")).toBe("rust");
    expect(langFromPath("Dockerfile")).toBe("dockerfile");
    expect(langFromPath(".env.local")).toBe("ini");
    expect(langFromPath("README")).toBeNull();
  });
});

describe("highlight", () => {
  test("produces tokens for a known language", async () => {
    const html = await highlight("const x: number = 1 // hi", "typescript");
    expect(html).toContain("<pre");
    expect(html).toContain("color:#C792EA");
    expect(html).toContain("font-style:italic"); // comment
    expect(html).toContain("color:#F78C6C"); // number
  });
  test("unknown languages stay plain", async () => {
    expect(await highlight("x", null)).toBeNull();
  });
});

describe("snippetAround", () => {
  test("centers on the match and collapses whitespace", () => {
    const text = "a".repeat(200) + " needle\n\nhere " + "b".repeat(200);
    const s = snippetAround(text, "NEEDLE", 10, 10);
    expect(s.startsWith("...")).toBe(true);
    expect(s.endsWith("...")).toBe(true);
    expect(s).toContain("needle here");
  });
});
