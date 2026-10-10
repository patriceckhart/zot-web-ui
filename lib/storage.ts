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

export function newID(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
