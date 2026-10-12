import type { Conversation } from "./protocol";

export type ConversationRow = {
  conversation: Conversation;
  depth: number;
  hasChildren: boolean;
};

// Ownership defines the tree. Forks remain independent top-level conversations.
// Preserve list order, and keep orphaned or cyclic records reachable.
export function conversationRows(conversations: Conversation[], collapsed: ReadonlySet<string> = new Set()): ConversationRow[] {
  const ids = new Set(conversations.map((c) => c.id));
  const children = new Map<string, Conversation[]>();
  const roots: Conversation[] = [];
  for (const c of conversations) {
    const parent = c.owner?.conversation_id;
    if (!parent || parent === c.id || !ids.has(parent)) {
      roots.push(c);
    } else {
      const siblings = children.get(parent) ?? [];
      siblings.push(c);
      children.set(parent, siblings);
    }
  }
  const rows: ConversationRow[] = [];
  const visited = new Set<string>();
  const walk = (root: Conversation) => {
    const stack = [{ conversation: root, depth: 0, visible: true }];
    while (stack.length) {
      const item = stack.pop()!;
      const c = item.conversation;
      if (visited.has(c.id)) continue;
      visited.add(c.id);
      const descendants = children.get(c.id) ?? [];
      if (item.visible) rows.push({ conversation: c, depth: item.depth, hasChildren: descendants.length > 0 });
      for (let i = descendants.length - 1; i >= 0; i--) {
        stack.push({ conversation: descendants[i], depth: item.depth + 1, visible: item.visible && !collapsed.has(c.id) });
      }
    }
  };
  roots.forEach(walk);
  // A cycle has no root. Start at the first remaining record to break it.
  conversations.forEach((c) => {
    if (!visited.has(c.id)) walk(c);
  });
  return rows;
}
