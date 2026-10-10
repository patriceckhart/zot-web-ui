import { describe, expect, test } from "bun:test";
import { applyChange, buildItems, fromSnapshot } from "./conversation";
import type { ConversationSnapshot } from "./protocol";

const base: ConversationSnapshot = {
  revision: 5,
  conversation: { id: "c1", created: "2026-01-01T00:00:00Z", revision: 5, config: { provider: "openai", model: "m" }, entry_sequence: 0 },
  // Go encodes empty slices as null.
  entries: null as unknown as [],
  queue: null as unknown as [],
  usage: { usage: { input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0 }, known: 0, unknown: 0 },
};

describe("conversation state", () => {
  test("snapshot with null slices", () => {
    const s = fromSnapshot(base);
    expect(s.entries.size).toBe(0);
    expect(buildItems(s)).toEqual([]);
  });

  test("a turn with a tool call pairs result and clears the chain", () => {
    let s = fromSnapshot(base);
    s = applyChange(s, {
      revision: 6,
      ops: [
        { doc: "entries", op: "put", key: "1", value: { id: "e1", type: "user", content: "list files" } },
        { doc: "execution", op: "put", key: "chain", value: { run_id: "r1" } },
      ],
    });
    expect(s.chain).toBeDefined();
    s = applyChange(s, { revision: 7, ops: [{ doc: "partial", op: "put", value: { text: "Let me", turn: 1 } }] });
    expect(buildItems(s).at(-1)).toMatchObject({ kind: "streaming", text: "Let me" });
    s = applyChange(s, {
      revision: 8,
      ops: [
        {
          doc: "entries",
          op: "put",
          key: "2",
          value: { id: "e2", type: "assistant", content: "", message: { role: "assistant", content: [{ text: "Let me look." }, { id: "t1", name: "bash", arguments: { command: "ls" } }] } },
        },
        { doc: "execution", op: "put", key: "task/k1", value: { id: "k1", kind: "zot.tool", state: "running", effect: "started", input: { call_id: "t1", name: "bash" } } },
        { doc: "partial", op: "delete" },
      ],
    });
    let items = buildItems(s);
    expect(items.find((i) => i.kind === "streaming")).toBeUndefined();
    expect(items.find((i) => i.kind === "tool")).toMatchObject({ name: "bash", running: true });

    s = applyChange(s, {
      revision: 9,
      ops: [
        { doc: "entries", op: "put", key: "3", value: { id: "e3", type: "tool_result", content: "a\nb", message: { role: "tool", content: [{ call_id: "t1", content: [{ text: "a\nb" }], is_error: false }] } } },
        { doc: "execution", op: "put", key: "task/k1", value: { id: "k1", kind: "zot.tool", state: "terminal" } },
        { doc: "execution", op: "delete", key: "chain" },
        { doc: "usage", op: "put", key: "1", value: { source: "model", usage: { input_tokens: 100, output_tokens: 5, cost_usd: 0.01 } } },
      ],
    });
    items = buildItems(s);
    expect(s.chain).toBeUndefined();
    expect(items.find((i) => i.kind === "tool")).toMatchObject({ running: false, result: { text: "a\nb", isError: false } });
    expect(s.usage.cost_usd).toBeCloseTo(0.01);
  });

  test("replayed changes are ignored", () => {
    let s = fromSnapshot(base);
    const change = { revision: 6, ops: [{ doc: "usage" as const, op: "put" as const, key: "1", value: { source: "model", usage: { cost_usd: 1 } } }] };
    s = applyChange(s, change);
    s = applyChange(s, change);
    expect(s.usage.cost_usd).toBe(1);
  });

  test("decided approvals and claimed submissions disappear", () => {
    let s = fromSnapshot(base);
    s = applyChange(s, {
      revision: 6,
      ops: [
        { doc: "approvals", op: "put", key: "a1", value: { id: "a1", tool: "bash", state: "pending" } },
        { doc: "queue", op: "put", key: "submission/s1", value: { id: "s1", state: "queued", content: "next" } },
      ],
    });
    expect(s.approvals.size).toBe(1);
    expect(s.queue.size).toBe(1);
    s = applyChange(s, {
      revision: 7,
      ops: [
        { doc: "approvals", op: "put", key: "a1", value: { id: "a1", tool: "bash", state: "allowed" } },
        { doc: "queue", op: "put", key: "submission/s1", value: { id: "s1", state: "running" } },
      ],
    });
    expect(s.approvals.size).toBe(0);
    expect(s.queue.size).toBe(0);
  });
});
