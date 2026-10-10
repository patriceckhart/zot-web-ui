"use client";

import { useEffect, useRef, useState } from "react";
import type { HostClient } from "./client";
import type { ConversationSnapshot, ViewChange } from "./protocol";
import { applyChange, fromSnapshot, type ConversationState } from "./conversation";

// useConversation keeps a live view of one conversation: a snapshot followed
// by a view-mode watch from its revision. When the watch ends with an error
// (cursor expired, lag), it takes a fresh snapshot and watches again.
export function useConversation(client: HostClient | null, id: string | null) {
  const [state, setState] = useState<ConversationState | null>(null);
  const [error, setError] = useState("");
  const stateRef = useRef<ConversationState | null>(null);

  useEffect(() => {
    if (!client || !id) return;
    let cancelled = false;
    let cancelWatch: (() => void) | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const set = (s: ConversationState) => {
      stateRef.current = s;
      setState(s);
    };

    const start = async () => {
      try {
        const snap = await client.call<ConversationSnapshot>("conversation.snapshot", { id, limit: 400 });
        if (cancelled) return;
        set(fromSnapshot(snap));
        setError("");
        cancelWatch = client.watch(
          { id, after: snap.revision, mode: "view" },
          {
            onAck: () => {
              attempts = 0;
            },
            onFrame: (frame) => {
              if (frame.type !== "view" || !stateRef.current) return;
              set(applyChange(stateRef.current, frame.change as ViewChange));
            },
            onEnd: (err) => {
              if (cancelled || !client.open) return;
              if (err) setError(err.message);
              attempts += 1;
              retry = setTimeout(start, Math.min(5000, 250 * 2 ** attempts));
            },
          },
        );
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        if (client.open) {
          attempts += 1;
          retry = setTimeout(start, Math.min(5000, 250 * 2 ** attempts));
        }
      }
    };

    stateRef.current = null;
    void start();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      cancelWatch?.();
      stateRef.current = null;
      setState(null);
    };
  }, [client, id]);

  return { state: state?.id === id ? state : null, error };
}
