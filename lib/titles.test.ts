import { describe, expect, test } from "bun:test";
import { conversationTitle, renameConversation } from "./titles";
import type { Conversation } from "./protocol";

const base: Conversation = { id: "c123456789", created: "2026-01-01", revision: 5, config: { provider: "synthetic", model: "test" } };

describe("conversation titles", () => {
  test("persisted titles override browser aliases and workspace labels", () => {
    expect(conversationTitle({ ...base, title: "Shared title" }, "workspace", "Local alias")).toBe("Shared title");
    expect(conversationTitle({ ...base, title: "" }, "workspace", "Local alias")).toBe("workspace");
    expect(conversationTitle({ ...base, title: "" }, undefined, "Local alias")).toBe("conversation c1234567");
    expect(conversationTitle(base, "workspace", "Local alias")).toBe("Local alias");
  });

  test("untitled forks and subagents keep identity fallbacks", () => {
    expect(conversationTitle({ ...base, title: "", parent: { conversation_id: "parent", at: 1 } })).toBe("fork c1234567");
    expect(conversationTitle({ ...base, title: "", owner: { conversation_id: "parent", id: "task" } })).toBe("subagent c1234567");
  });

  test("rename reads a fresh revision and waits for the host acknowledgement", async () => {
    const calls: { method: string; params: unknown }[] = [];
    const renamed = { ...base, revision: 11, title: "Prüfung" };
    const client = {
      async call<T>(method: string, params?: unknown): Promise<T> {
        calls.push({ method, params });
        return (method === "conversation.snapshot" ? { conversation: { ...base, revision: 10 } } : renamed) as T;
      },
    };
    expect(await renameConversation(client, base.id, "  Prüfung  ")).toEqual(renamed);
    expect(calls).toEqual([
      { method: "conversation.snapshot", params: { id: base.id, limit: 1 } },
      { method: "conversation.rename", params: { id: base.id, expected_revision: 10, title: "Prüfung" } },
    ]);
  });

  test("clear sends an explicit empty title", async () => {
    const client = {
      async call<T>(method: string, params?: unknown): Promise<T> {
        if (method === "conversation.rename") expect(params).toEqual({ id: base.id, expected_revision: 5, title: "" });
        return (method === "conversation.snapshot" ? { conversation: base } : { ...base, title: "" }) as T;
      },
    };
    expect((await renameConversation(client, base.id, " ")).title).toBe("");
  });

  test("host errors propagate instead of saving a browser-only name", async () => {
    for (const message of ["forbidden", "conflict", "unknown method", "disconnected"]) {
      const client = {
        async call<T>(method: string): Promise<T> {
          if (method === "conversation.snapshot") return { conversation: base } as T;
          throw new Error(message);
        },
      };
      await expect(renameConversation(client, base.id, "new")).rejects.toThrow(message);
    }
  });
});
