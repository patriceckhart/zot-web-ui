// Helpers for the optional zotty bridge. The bridge is a separate program
// on the host (github.com/patriceckhart/zotty); zot itself has no shell
// access.

// terminalURL turns what the user typed into the bridge's WebSocket URL.
// It accepts http(s) and ws(s) URLs, with or without the /term path.
export function terminalURL(input: string): string {
  let raw = input.trim();
  if (!raw) throw new Error("terminal URL is empty");
  if (!/^[a-z]+:\/\//i.test(raw)) raw = `wss://${raw}`;
  const u = new URL(raw);
  switch (u.protocol) {
    case "https:":
      u.protocol = "wss:";
      break;
    case "http:":
      u.protocol = "ws:";
      break;
    case "wss:":
    case "ws:":
      break;
    default:
      throw new Error(`unsupported terminal URL scheme ${u.protocol}`);
  }
  if (u.pathname === "" || u.pathname === "/") u.pathname = "/term";
  u.search = "";
  u.hash = "";
  return u.toString();
}

// Key sequences for the on-screen key bar on touch devices.
export const KEYS = {
  esc: "\x1b",
  tab: "\t",
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  left: "\x1b[D",
} as const;

// ctrlKey maps a typed character to its control code (Ctrl+C -> 0x03).
// Characters without a control mapping are returned unchanged.
export function ctrlKey(data: string): string {
  if (data.length !== 1) return data;
  const c = data.toUpperCase().charCodeAt(0);
  if (c >= 64 && c <= 95) return String.fromCharCode(c - 64);
  if (data === " ") return "\x00";
  if (data === "?") return "\x7f";
  return data;
}
