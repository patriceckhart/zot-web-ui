import { describe, expect, test } from "bun:test";
import { conversationRows } from "./conversation-tree";
import type { Conversation } from "./protocol";

function conversation(id: string, owner?: string): Conversation {
  return { id, created: "2026-10-12", revision: 1, config: { provider: "test", model: "test" }, ...(owner ? { owner: { conversation_id: owner, id: `call-${id}` } } : {}) };
}

const positions = (rows: ReturnType<typeof conversationRows>) => rows.map((r) => [r.conversation.id, r.depth, r.hasChildren]);

describe("conversationRows", () => {
  test("nests children regardless of input order and preserves sibling order", () => {
    expect(positions(conversationRows([
      conversation("grandchild", "child"), conversation("child", "main"),
      conversation("sibling", "main"), conversation("other"), conversation("main"),
    ]))).toEqual([
      ["other", 0, false], ["main", 0, true], ["child", 1, true],
      ["grandchild", 2, false], ["sibling", 1, false],
    ]);
  });
  test("collapsing hides all descendants without promoting them to roots", () => {
    const list = [conversation("main"), conversation("child", "main"), conversation("grandchild", "child")];
    expect(positions(conversationRows(list, new Set(["main"])))).toEqual([["main", 0, true]]);
    expect(positions(conversationRows(list, new Set(["child"])))).toEqual([["main", 0, true], ["child", 1, true]]);
    expect(conversationRows(list)).toHaveLength(3);
  });
  test("missing parents remain accessible and forks stay top-level", () => {
    const fork = { ...conversation("fork"), parent: { conversation_id: "main", at: 1 } };
    expect(positions(conversationRows([conversation("orphan", "missing"), conversation("main"), fork])))
      .toEqual([["orphan", 0, false], ["main", 0, false], ["fork", 0, false]]);
  });
  test("cycles and self-ownership do not loop or duplicate conversations", () => {
    const list = [conversation("a", "b"), conversation("b", "a"), conversation("self", "self")];
    expect(positions(conversationRows(list))).toEqual([["self", 0, false], ["a", 0, true], ["b", 1, true]]);
    expect(positions(conversationRows(list, new Set(["a"]))))
      .toEqual([["self", 0, false], ["a", 0, true]]);
  });
  test("empty list", () => {
    expect(conversationRows([])).toEqual([]);
  });
});
