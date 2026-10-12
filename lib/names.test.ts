import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadNames, saveName } from "./storage";

// Minimal localStorage for bun's test environment.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const g = globalThis as { window?: unknown };
let saved: unknown;

beforeEach(() => {
  saved = g.window;
  g.window = { localStorage: new MemoryStorage() };
});

afterEach(() => {
  g.window = saved;
});

describe("conversation names", () => {
  test("persist per host and trim", () => {
    saveName("wss://a", "c1", "  Auth review ");
    saveName("wss://b", "c1", "Other host");
    expect(loadNames("wss://a")).toEqual({ c1: "Auth review" });
    expect(loadNames("wss://b")).toEqual({ c1: "Other host" });
    expect(loadNames("wss://none")).toEqual({});
  });

  test("an empty name removes the entry", () => {
    saveName("wss://a", "c1", "x");
    saveName("wss://a", "c1", "  ");
    expect(loadNames("wss://a")).toEqual({});
  });

  test("corrupt storage falls back to no names", () => {
    (g.window as { localStorage: MemoryStorage }).localStorage.setItem("zot-names", "{not json");
    expect(loadNames("wss://a")).toEqual({});
    saveName("wss://a", "c1", "fresh");
    expect(loadNames("wss://a")).toEqual({ c1: "fresh" });
  });
});
