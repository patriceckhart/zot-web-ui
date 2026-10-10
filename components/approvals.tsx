"use client";

import { ShieldAlert } from "lucide-react";
import type { HostClient } from "@/lib/client";
import type { Approval } from "@/lib/protocol";
import { argsSummary } from "@/lib/conversation";

export function ApprovalBar({ client, approvals, onError }: { client: HostClient; approvals: Approval[]; onError: (msg: string) => void }) {
  const allowed = client.role === "approve" || client.role === "admin";
  const decide = (a: Approval, allow: boolean, scope: "call" | "tool") => {
    client.call("approval.decide", { id: a.id, allow, scope, reason: "web" }).catch((err) => onError((err as Error).message));
  };
  return (
    <div className="space-y-2 border-t border-border px-4 py-3">
      {approvals.map((a) => (
        <div key={a.id} className="rounded-md border border-primary/50 bg-primary/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 text-primary" /> Approve <span className="font-mono">{a.tool}</span>?
          </div>
          <pre className="mt-2 max-h-32 overflow-auto font-mono text-xs whitespace-pre-wrap break-all text-muted-foreground">{a.summary || argsSummary(a.tool, a.args) || JSON.stringify(a.args)}</pre>
          {allowed ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded border border-zot text-zot px-3 py-1 text-xs hover:bg-zot hover:text-black" onClick={() => decide(a, true, "call")}>Allow once</button>
              <button className="rounded border border-border px-3 py-1 text-xs hover:bg-accent" onClick={() => decide(a, true, "tool")}>Always allow {a.tool}</button>
              <button className="rounded border border-border px-3 py-1 text-xs text-destructive hover:bg-accent" onClick={() => decide(a, false, "call")}>Deny</button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">This token cannot decide approvals.</p>
          )}
        </div>
      ))}
    </div>
  );
}
