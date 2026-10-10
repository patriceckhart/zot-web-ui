"use client";

import { useState } from "react";
import { Plus, Trash2, Server } from "lucide-react";
import { AnimatedZ } from "./animated-z";
import { CommandCard } from "./command-card";
import type { HostProfile } from "@/lib/storage";
import { newID } from "@/lib/storage";

type Props = {
  hosts: HostProfile[];
  error?: string;
  connecting: boolean;
  onConnect: (host: HostProfile) => void;
  onSave: (hosts: HostProfile[]) => void;
};

export function ConnectScreen({ hosts, error, connecting, onConnect, onSave }: Props) {
  const [adding, setAdding] = useState(hosts.length === 0);
  const [name, setName] = useState("My Mac");
  const [url, setUrl] = useState("wss://");
  const [token, setToken] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const host: HostProfile = { id: newID(), name: name.trim() || url, url: url.trim(), token: token.trim() };
    onSave([...hosts, host]);
    setAdding(false);
    setToken("");
    onConnect(host);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 pt-[max(1.5rem,var(--top-inset))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <div className="mb-12 flex justify-center">
          <AnimatedZ width={72} height={72} />
        </div>

        {hosts.length > 0 && (
          <ul className="mb-6 divide-y divide-border rounded-lg border border-border">
            {hosts.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <button className="min-w-0 flex-1 text-left" disabled={connecting} onClick={() => onConnect(h)}>
                  <div className="truncate text-sm font-medium">{h.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{h.url}</div>
                </button>
                <button
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${h.name}`}
                  onClick={() => onSave(hosts.filter((x) => x.id !== h.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mb-4 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{error}</p>}
        {connecting && <p className="mb-4 text-sm text-muted-foreground">Connecting...</p>}

        {adding ? (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Host URL">
              <input className={`${inputClass} font-mono`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="wss://zot.example.ts.net" required />
            </Field>
            <Field label="Token">
              <input className={`${inputClass} font-mono`} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} required minLength={16} />
            </Field>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Hosts and tokens are kept in this tab&apos;s session storage only. They are cleared when the browser session ends and are sent only to the host you enter.
            </p>
            <div className="flex gap-2">
              <button type="submit" disabled={connecting} className="flex-1 rounded-md border border-zot text-zot px-4 py-2 text-sm hover:bg-zot hover:text-black disabled:opacity-50">
                Connect
              </button>
              {hosts.length > 0 && (
                <button type="button" onClick={() => setAdding(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            <Plus className="h-4 w-4" /> Add host
          </button>
        )}

        <details className="group mt-8 text-xs text-muted-foreground">
          <summary className="flex cursor-pointer list-none items-center gap-2 select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span className="inline-block h-3 w-[3px] bg-zot" />
            how do i start a host?
          </summary>
          <div className="mt-4 space-y-3">
            <CommandCard
              tabs={[
                { id: "start", label: "start", commands: ["zot continuous serve --store ~/.zot-store --web 127.0.0.1:7787"] },
                { id: "tailscale", label: "tailscale", commands: ["tailscale serve --bg --https=443 http://127.0.0.1:7787"] },
                { id: "cloudflared", label: "cloudflared", commands: ["cloudflared tunnel --url http://127.0.0.1:7787"] },
              ]}
            />
            <p className="leading-relaxed">
              zot prints the web token. From this site, connect through the tunnel URL with <span className="text-zot">wss://</span>.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
