"use client";

import { useEffect, useState } from "react";
import type { HostClient } from "./client";
import type { Conversation, SearchResult } from "./protocol";

export type SearchMatch = {
  conversation: Conversation;
  // count is the number of matching entries, capped at the per-conversation
  // limit; more is set when there are further matches.
  count: number;
  more: boolean;
  snippet: string;
  type: string;
};

const PER_CONVERSATION = 20;
const CONCURRENCY = 6;
const DEBOUNCE_MS = 250;

// snippetAround returns a short excerpt around the first match. Little
// context is kept before the match so it stays visible in a two-line clamp.
export function snippetAround(text: string, needle: string, before = 24, after = 90): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const i = flat.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return flat.slice(0, before + after);
  const start = Math.max(0, i - before);
  const end = Math.min(flat.length, i + needle.length + after);
  return (start > 0 ? "..." : "") + flat.slice(start, end) + (end < flat.length ? "..." : "");
}

// useConversationSearch searches the text of every conversation on the host
// with conversation.search. Queries shorter than two characters are skipped.
export function useConversationSearch(client: HostClient, conversations: Conversation[], query: string) {
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setMatches([]);
      setSearching(false);
      setError("");
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const found: SearchMatch[] = [];
      const queue = [...conversations];
      let failure = "";
      const worker = async () => {
        while (!cancelled && queue.length > 0) {
          const c = queue.shift()!;
          try {
            const res = await client.call<SearchResult>("conversation.search", {
              conversation_id: c.id,
              text: q,
              types: ["user", "assistant", "steer", "tool_result"],
              limit: PER_CONVERSATION,
            });
            const hits = res.hits ?? [];
            if (hits.length > 0) {
              const best = hits.find((h) => h.entry.type !== "tool_result") ?? hits[0];
              found.push({ conversation: c, count: hits.length, more: res.more, snippet: snippetAround(best.entry.content, q), type: best.entry.type });
            }
          } catch (err) {
            failure = (err as Error).message;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, conversations.length) }, worker));
      if (cancelled) return;
      found.sort((a, b) => b.count - a.count || b.conversation.created.localeCompare(a.conversation.created));
      setMatches(found);
      setError(found.length === 0 ? failure : "");
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, conversations, q]);

  return { matches, searching, error, active: q.length >= 2 };
}
