"use client";

import { useEffect, useState } from "react";
import type { HostClient } from "./client";
import type { Conversation, ConversationSnapshot } from "./protocol";

export type Activity = "idle" | "working" | "approval" | "queued";

// activityOf derives a conversation's state from a snapshot: an active
// chain is working (or awaiting approval), queued inputs without a chain
// are queued, anything else is idle.
export function activityOf(s: Pick<ConversationSnapshot, "chain" | "approvals" | "queue">): Activity {
  if (s.chain) {
    return (s.approvals ?? []).some((a) => a.state === "pending") ? "approval" : "working";
  }
  return (s.queue ?? []).length > 0 ? "queued" : "idle";
}

const POLL_MS = 4000;
const CONCURRENCY = 6;

// useActivity polls a small snapshot (one entry) per conversation to show
// which sessions are running. Live state of the open chat is merged in by
// the caller, so it updates without waiting for the next poll.
export function useActivity(client: HostClient, conversations: Conversation[]) {
  const [activity, setActivity] = useState<Record<string, Activity>>({});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const queue = [...conversations];
      const next: Record<string, Activity> = {};
      const worker = async () => {
        while (!cancelled && queue.length > 0) {
          const c = queue.shift()!;
          try {
            const snap = await client.call<ConversationSnapshot>("conversation.snapshot", { id: c.id, limit: 1 });
            next[c.id] = activityOf(snap);
          } catch {
            // A missing or unreadable conversation keeps no indicator.
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, conversations.length) }, worker));
      if (cancelled) return;
      setActivity(next);
      timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, conversations]);

  return activity;
}
