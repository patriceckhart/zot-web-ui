import { describe, expect, test } from "bun:test";
import { activityOf } from "./use-activity";
import type { Approval, Chain, Submission } from "./protocol";

const chain = { run_id: "r" } as Chain;

describe("activityOf", () => {
  test("idle without chain or queue", () => {
    expect(activityOf({ queue: [] })).toBe("idle");
    // Go encodes empty slices as null.
    expect(activityOf({ queue: null as unknown as Submission[] })).toBe("idle");
  });
  test("working with an active chain", () => {
    expect(activityOf({ chain, queue: [] })).toBe("working");
  });
  test("approval wins while a chain waits on a decision", () => {
    expect(activityOf({ chain, queue: [], approvals: [{ state: "pending" } as Approval] })).toBe("approval");
    expect(activityOf({ chain, queue: [], approvals: [{ state: "allowed" } as Approval] })).toBe("working");
  });
  test("queued inputs without a chain", () => {
    expect(activityOf({ queue: [{ id: "s" } as Submission] })).toBe("queued");
  });
});
