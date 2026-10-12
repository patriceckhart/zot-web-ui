// Connection settings live in sessionStorage only: they belong to one browser
// tab session and disappear when it ends. Nothing is sent anywhere except to
// the host the user configured.

export type HostProfile = {
  id: string;
  name: string;
  url: string;
  token: string;
};

const HOSTS = "zot-hosts";
const ACTIVE = "zot-active-host";
const LABELS = "zot-labels";
const TERMINALS = "zot-terminals";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode quotas); settings then last
    // only for the page lifetime.
  }
}

export function loadHosts(): HostProfile[] {
  return read<HostProfile[]>(HOSTS, []);
}

export function saveHosts(hosts: HostProfile[]) {
  write(HOSTS, hosts);
}

export function loadActiveHost(): string | null {
  return read<string | null>(ACTIVE, null);
}

export function saveActiveHost(id: string | null) {
  write(ACTIVE, id);
}

// Labels map conversation IDs to the workspace name they were opened with.
// The host stores workspace identities hashed, so the client remembers them.
export function loadLabels(): Record<string, string> {
  return read<Record<string, string>>(LABELS, {});
}

export function saveLabel(conversationID: string, label: string) {
  write(LABELS, { ...loadLabels(), [conversationID]: label });
}

// Conversation names chosen by the user. zot has no rename method, so names
// live in this browser. They persist in localStorage (unlike tokens), keyed
// by host URL so the same conversation ID on another host is not affected.
const NAMES = "zot-names";

function readNames(): Record<string, Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(NAMES);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function loadNames(hostURL: string): Record<string, string> {
  return readNames()[hostURL] ?? {};
}

// saveName stores a name; an empty name removes it.
export function saveName(hostURL: string, conversationID: string, name: string) {
  const all = readNames();
  const names = { ...(all[hostURL] ?? {}) };
  const trimmed = name.trim();
  if (trimmed) names[conversationID] = trimmed;
  else delete names[conversationID];
  all[hostURL] = names;
  try {
    window.localStorage.setItem(NAMES, JSON.stringify(all));
  } catch {
    // Not persisted; the name lasts for the page lifetime.
  }
}

// Panel widths are layout preferences, not credentials, so they persist in
// localStorage across sessions.
export function loadWidth(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const v = Number(window.localStorage.getItem(`zot-width-${key}`));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

export function saveWidth(key: string, width: number) {
  try {
    window.localStorage.setItem(`zot-width-${key}`, String(Math.round(width)));
  } catch {
    // Not persisted; the width lasts for the page lifetime.
  }
}

// Terminal bridge settings (zotty URL and token) per host profile ID.
export type TerminalProfile = { url: string; token: string };

export function loadTerminal(hostID: string): TerminalProfile | null {
  return read<Record<string, TerminalProfile>>(TERMINALS, {})[hostID] ?? null;
}

export function saveTerminal(hostID: string, profile: TerminalProfile) {
  write(TERMINALS, { ...read<Record<string, TerminalProfile>>(TERMINALS, {}), [hostID]: profile });
}

export function newID(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
