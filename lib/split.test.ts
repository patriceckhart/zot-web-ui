import { describe, expect, test } from "bun:test";
import { layout, leaf, leaves, remove, setRatio, split } from "./split";

describe("split", () => {
  test("left and top put the new pane first", () => {
    expect(leaves(split(leaf("a"), "a", "left", "b"))).toEqual(["b", "a"]);
    expect(leaves(split(leaf("a"), "a", "top", "b"))).toEqual(["b", "a"]);
    expect(leaves(split(leaf("a"), "a", "right", "b"))).toEqual(["a", "b"]);
    expect(leaves(split(leaf("a"), "a", "bottom", "b"))).toEqual(["a", "b"]);
  });

  test("splits only the target pane", () => {
    let t = split(leaf("a"), "a", "right", "b");
    t = split(t, "b", "bottom", "c");
    expect(leaves(t)).toEqual(["a", "b", "c"]);
    expect(split(t, "missing", "left", "d")).toEqual(t);
  });
});

describe("remove", () => {
  test("sibling takes over the parent's space", () => {
    let t = split(leaf("a"), "a", "right", "b");
    t = split(t, "b", "bottom", "c");
    const r = remove(t, "b")!;
    expect(leaves(r)).toEqual(["a", "c"]);
    expect(layout(r).panes.find((p) => p.id === "c")!.rect).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
  });

  test("removing the last pane returns null", () => {
    expect(remove(leaf("a"), "a")).toBeNull();
  });
});

describe("layout", () => {
  test("computes pane rects and dividers", () => {
    let t = split(leaf("a"), "a", "right", "b");
    t = split(t, "b", "bottom", "c");
    const l = layout(t);
    expect(l.panes).toEqual([
      { id: "a", rect: { x: 0, y: 0, w: 0.5, h: 1 } },
      { id: "b", rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
      { id: "c", rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
    ]);
    expect(l.dividers.map((d) => [d.path.join(""), d.dir])).toEqual([
      ["", "row"],
      ["b", "col"],
    ]);
  });

  test("setRatio resizes one split and clamps", () => {
    let t = split(leaf("a"), "a", "right", "b");
    t = setRatio(t, [], 0.25);
    expect(layout(t).panes[0].rect.w).toBe(0.25);
    expect(layout(setRatio(t, [], 5)).panes[0].rect.w).toBe(0.9);
  });
});
