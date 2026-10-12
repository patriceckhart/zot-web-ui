// Split layout for terminal panes. The tree only describes geometry: panes
// are rendered flat (keyed by ID) and positioned from layout(), so splitting
// or closing one pane never remounts, and never kills, the shells of others.

export type Side = "left" | "right" | "top" | "bottom";

export type SplitTree =
  | { type: "leaf"; id: string }
  | { type: "split"; dir: "row" | "col"; ratio: number; a: SplitTree; b: SplitTree };

export type Rect = { x: number; y: number; w: number; h: number };

// Path from the root to a split node: "a"/"b" steps.
export type Path = ("a" | "b")[];

export const MIN_RATIO = 0.1;

export function leaf(id: string): SplitTree {
  return { type: "leaf", id };
}

export function leaves(t: SplitTree): string[] {
  return t.type === "leaf" ? [t.id] : [...leaves(t.a), ...leaves(t.b)];
}

// split puts a new pane next to target on the given side, sharing its space
// equally. Unknown targets leave the tree unchanged.
export function split(t: SplitTree, target: string, side: Side, newID: string): SplitTree {
  if (t.type === "leaf") {
    if (t.id !== target) return t;
    const added = leaf(newID);
    const dir = side === "left" || side === "right" ? "row" : "col";
    const first = side === "left" || side === "top";
    return { type: "split", dir, ratio: 0.5, a: first ? added : t, b: first ? t : added };
  }
  return { ...t, a: split(t.a, target, side, newID), b: split(t.b, target, side, newID) };
}

// remove drops a pane; its sibling takes the parent's space. Returns null
// when the last pane is removed.
export function remove(t: SplitTree, id: string): SplitTree | null {
  if (t.type === "leaf") return t.id === id ? null : t;
  const a = remove(t.a, id);
  const b = remove(t.b, id);
  if (!a) return b;
  if (!b) return a;
  return a === t.a && b === t.b ? t : { ...t, a, b };
}

export function setRatio(t: SplitTree, path: Path, ratio: number): SplitTree {
  if (t.type === "leaf") return t;
  if (path.length === 0) return { ...t, ratio: clampRatio(ratio) };
  const [step, ...rest] = path;
  return step === "a" ? { ...t, a: setRatio(t.a, rest, ratio) } : { ...t, b: setRatio(t.b, rest, ratio) };
}

export function clampRatio(r: number): number {
  if (!Number.isFinite(r)) return 0.5;
  return Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, r));
}

export type Layout = {
  panes: { id: string; rect: Rect }[];
  // Each divider sits on the border between a split's two halves. parent is
  // the split's own rect, needed to turn a pointer position into a ratio.
  dividers: { path: Path; dir: "row" | "col"; rect: Rect; parent: Rect }[];
};

// layout computes rects in fractions of the container (0..1).
export function layout(t: SplitTree, rect: Rect = { x: 0, y: 0, w: 1, h: 1 }, path: Path = []): Layout {
  if (t.type === "leaf") return { panes: [{ id: t.id, rect }], dividers: [] };
  let ra: Rect, rb: Rect, divider: Rect;
  if (t.dir === "row") {
    const w = rect.w * t.ratio;
    ra = { ...rect, w };
    rb = { ...rect, x: rect.x + w, w: rect.w - w };
    divider = { x: rect.x + w, y: rect.y, w: 0, h: rect.h };
  } else {
    const h = rect.h * t.ratio;
    ra = { ...rect, h };
    rb = { ...rect, y: rect.y + h, h: rect.h - h };
    divider = { x: rect.x, y: rect.y + h, w: rect.w, h: 0 };
  }
  const la = layout(t.a, ra, [...path, "a"]);
  const lb = layout(t.b, rb, [...path, "b"]);
  return {
    panes: [...la.panes, ...lb.panes],
    dividers: [{ path, dir: t.dir, rect: divider, parent: rect }, ...la.dividers, ...lb.dividers],
  };
}
