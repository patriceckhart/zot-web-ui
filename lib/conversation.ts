// Conversation state: a committed snapshot plus view changes from a
// `conversation.watch` in view mode. Everything here is a pure projection so
// it is easy to test and replays identically after a reconnect.

import type {
  AgentConfig,
  Approval,
  Chain,
  ContentBlock,
  ConversationSnapshot,
  Entry,
  Partial,
  Submission,
  Task,
  ToolProgress,
  Usage,
  UsageRecord,
  ViewChange,
} from "./protocol";

export type ConversationState = {
  id: string;
  title?: string;
  revision: number;
  config: AgentConfig;
  entries: Map<number, Entry>;
  firstSequence: number;
  more: boolean;
  partial?: Partial;
  progress: Map<string, ToolProgress>;
  tasks: Map<string, Task>;
  chain?: Chain;
  approvals: Map<string, Approval>;
  queue: Map<string, Submission>;
  usage: Usage;
  lastModelUsage?: UsageRecord;
  queueHeld: boolean;
};

const zeroUsage: Usage = { input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0 };

export function fromSnapshot(s: ConversationSnapshot): ConversationState {
  // Go encodes empty slices as null.
  const list = s.entries ?? [];
  const entries = new Map<number, Entry>();
  const total = s.conversation.entry_sequence ?? list.length;
  const first = total - list.length + 1;
  list.forEach((e, i) => entries.set(first + i, e));
  return {
    id: s.conversation.id,
    title: s.conversation.title,
    revision: s.revision,
    config: s.conversation.config,
    entries,
    firstSequence: first,
    more: !!s.more,
    partial: s.partial && !s.partial.final ? s.partial : undefined,
    progress: new Map((s.progress ?? []).map((p) => [p.task_id, p])),
    tasks: new Map((s.tasks ?? []).map((t) => [t.id, t])),
    chain: s.chain,
    approvals: new Map((s.approvals ?? []).filter((a) => a.state === "pending").map((a) => [a.id, a])),
    queue: new Map((s.queue ?? []).map((q) => [q.id, q])),
    usage: s.usage?.usage ?? zeroUsage,
    queueHeld: !!s.conversation.queue_held,
  };
}

function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + (b.input_tokens ?? 0),
    output_tokens: a.output_tokens + (b.output_tokens ?? 0),
    reasoning_tokens: a.reasoning_tokens + (b.reasoning_tokens ?? 0),
    cache_read_tokens: a.cache_read_tokens + (b.cache_read_tokens ?? 0),
    cache_write_tokens: a.cache_write_tokens + (b.cache_write_tokens ?? 0),
    cost_usd: a.cost_usd + (b.cost_usd ?? 0),
  };
}

// applyChange folds one view change into the state. Changes at or below the
// current revision are ignored, so replays after a reconnect are harmless.
export function applyChange(state: ConversationState, change: ViewChange): ConversationState {
  if (change.revision <= state.revision) return state;
  const next: ConversationState = {
    ...state,
    revision: change.revision,
    entries: new Map(state.entries),
    progress: new Map(state.progress),
    tasks: new Map(state.tasks),
    approvals: new Map(state.approvals),
    queue: new Map(state.queue),
  };
  for (const op of change.ops) {
    const del = op.op === "delete";
    switch (op.doc) {
      case "entries": {
        const seq = Number(op.key || 0);
        if (del) next.entries.delete(seq);
        else next.entries.set(seq, op.value as Entry);
        if (seq < next.firstSequence) next.firstSequence = seq;
        const e = op.value as Entry | undefined;
        if (!del && e?.type === "assistant") next.partial = undefined;
        break;
      }
      case "partial": {
        const p = op.value as Partial | undefined;
        next.partial = del || !p || p.final ? undefined : p;
        break;
      }
      case "progress":
        if (del) next.progress.delete(op.key ?? "");
        else next.progress.set(op.key ?? "", op.value as ToolProgress);
        break;
      case "execution":
        if (op.key === "chain") {
          next.chain = del ? undefined : (op.value as Chain);
        } else if (op.key?.startsWith("task/")) {
          const t = op.value as Task;
          if (del || t.state === "terminal") {
            next.tasks.delete(op.key.slice(5));
            next.progress.delete(op.key.slice(5));
          } else next.tasks.set(t.id, t);
        }
        break;
      case "approvals": {
        const a = op.value as Approval;
        if (del || a.state !== "pending") next.approvals.delete(op.key ?? a?.id);
        else next.approvals.set(a.id, a);
        break;
      }
      case "queue": {
        if (op.key?.startsWith("submission/")) {
          const s = op.value as Submission;
          if (s.state === "queued") next.queue.set(s.id, s);
          else next.queue.delete(s.id);
        }
        break;
      }
      case "usage": {
        if (!del) {
          const row = op.value as UsageRecord;
          next.usage = addUsage(next.usage, row.usage);
          if (row.source === "model" && !row.tool) next.lastModelUsage = row;
        }
        break;
      }
      case "metadata":
        if (!del) next.title = (op.value as { title: string }).title;
        break;
      case "agent":
        if (!del) next.config = op.value as AgentConfig;
        break;
    }
  }
  return next;
}

export function isBusy(s: ConversationState): boolean {
  return !!s.chain;
}

// Transcript items rendered by the chat view.

export type ToolCallItem = {
  kind: "tool";
  id: string;
  name: string;
  args: unknown;
  result?: { text: string; isError: boolean; images: ContentBlock[] };
  running: boolean;
  progress?: string;
};

export type Item =
  | { kind: "user"; key: string; text: string; images: { mime_type: string; data: string }[]; steer?: boolean; time?: string }
  | { kind: "assistant"; key: string; text: string; time?: string }
  | { kind: "thought"; key: string; text: string }
  | (ToolCallItem & { key: string })
  | { kind: "notice"; key: string; text: string; tone: "error" | "info" }
  | { kind: "streaming"; key: string; text: string };

function resultText(blocks: ContentBlock[] | undefined): string {
  return (blocks ?? [])
    .filter((b) => b.text !== undefined)
    .map((b) => b.text)
    .join("\n");
}

export function buildItems(s: ConversationState): Item[] {
  const items: Item[] = [];
  const tools = new Map<string, ToolCallItem & { key: string }>();
  const seqs = [...s.entries.keys()].sort((a, b) => a - b);
  for (const seq of seqs) {
    const e = s.entries.get(seq)!;
    const key = `e${seq}`;
    switch (e.type) {
      case "user":
      case "steer":
      case "continue":
        items.push({ kind: "user", key, text: e.content, images: e.images ?? [], steer: e.type === "steer", time: e.time });
        break;
      case "assistant": {
        const blocks = e.message?.content ?? [];
        let text = "";
        let i = 0;
        const flush = () => {
          if (text.trim()) items.push({ kind: "assistant", key: `${key}t${i++}`, text, time: e.time });
          text = "";
        };
        for (const b of blocks) {
          if (b.reasoning_id !== undefined || b.summary !== undefined || b.encrypted_content !== undefined) {
            if (b.summary?.trim()) {
              flush();
              items.push({ kind: "thought", key: `${key}r${i++}`, text: b.summary });
            }
          } else if (b.name && b.id) {
            flush();
            const item: ToolCallItem & { key: string } = { kind: "tool", key: `${key}c${b.id}`, id: b.id, name: b.name, args: b.arguments, running: false };
            tools.set(b.id, item);
            items.push(item);
          } else if (b.call_id) {
            // Not expected in assistant messages.
          } else if (b.mime_type) {
            // Model-produced images are not rendered.
          } else if (b.text !== undefined) {
            text += (text ? "\n\n" : "") + b.text;
          }
        }
        if (blocks.length === 0 && e.content) text = e.content;
        flush();
        break;
      }
      case "tool_result": {
        for (const b of e.message?.content ?? []) {
          if (!b.call_id) continue;
          const t = tools.get(b.call_id);
          const result = { text: resultText(b.content), isError: !!b.is_error, images: (b.content ?? []).filter((c) => c.mime_type) };
          if (t) t.result = result;
          else items.push({ kind: "notice", key: `${key}${b.call_id}`, text: result.text, tone: result.isError ? "error" : "info" });
        }
        break;
      }
      case "attempt":
        if (e.content) items.push({ kind: "notice", key, text: e.content, tone: "error" });
        break;
      case "compaction":
        items.push({ kind: "notice", key, text: "Context compacted", tone: "info" });
        break;
      case "reset":
        items.push({ kind: "notice", key, text: e.content ? `Context reset: ${e.content}` : "Context reset", tone: "info" });
        break;
    }
  }
  // Live state: running tool tasks and their progress.
  for (const t of s.tasks.values()) {
    if (t.kind !== "zot.tool") continue;
    const callID = t.input?.call_id;
    if (!callID) continue;
    const item = tools.get(callID);
    const started = t.effect === "started" || t.phase === "subagent";
    if (item && !item.result) {
      item.running = started;
      const p = s.progress.get(t.id);
      if (p) item.progress = p.text;
    }
  }
  if (s.partial?.text) items.push({ kind: "streaming", key: "partial", text: s.partial.text });
  return items;
}

export function shortPath(label: string): string {
  return label.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function argsSummary(name: string, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  const pick = a.command ?? a.path ?? a.file_path ?? a.pattern ?? a.query ?? a.url ?? a.task ?? a.prompt;
  if (typeof pick === "string") return pick.replace(/\s+/g, " ");
  const s = JSON.stringify(args);
  return s === "{}" ? "" : s;
}
