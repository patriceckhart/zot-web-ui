import { describe, expect, test } from "bun:test";
import { ctrlKey, terminalURL } from "./terminal";

describe("terminalURL", () => {
  test("maps http schemes to websocket schemes and adds /term", () => {
    expect(terminalURL("https://mac.tail1234.ts.net")).toBe("wss://mac.tail1234.ts.net/term");
    expect(terminalURL("http://127.0.0.1:7789")).toBe("ws://127.0.0.1:7789/term");
  });
  test("keeps websocket URLs and explicit paths", () => {
    expect(terminalURL("wss://term.example.com/term")).toBe("wss://term.example.com/term");
    expect(terminalURL("ws://localhost:7789/custom")).toBe("ws://localhost:7789/custom");
  });
  test("defaults to wss without a scheme and drops query and hash", () => {
    expect(terminalURL(" term.example.com/?x=1#y ")).toBe("wss://term.example.com/term");
  });
  test("rejects empty and unsupported URLs", () => {
    expect(() => terminalURL("")).toThrow();
    expect(() => terminalURL("ftp://example.com")).toThrow();
  });
});

describe("ctrlKey", () => {
  test("maps letters to control codes", () => {
    expect(ctrlKey("c")).toBe("\x03");
    expect(ctrlKey("D")).toBe("\x04");
    expect(ctrlKey("[")).toBe("\x1b");
  });
  test("leaves other input unchanged", () => {
    expect(ctrlKey("1")).toBe("1");
    expect(ctrlKey("ab")).toBe("ab");
  });
});
