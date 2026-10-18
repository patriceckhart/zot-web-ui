import type { HostClient } from "./client";
import type { Conversation, ConversationSnapshot } from "./protocol";

export function conversationTitle(c: Conversation, label?: string, legacyName?: string): string {
  // Browser-only names are a fallback for older hosts, never an override of
  // persisted metadata (including an explicitly cleared title).
  const name = c.title === undefined ? legacyName : c.title;
  return name || label || (c.owner ? `subagent ${c.id.slice(0, 8)}` : c.parent ? `fork ${c.id.slice(0, 8)}` : `conversation ${c.id.slice(0, 8)}`);
}

export async function renameConversation(client: Pick<HostClient, "call">, id: string, title: string): Promise<Conversation> {
  // The sidebar list is polled, so obtain a fresh conversation revision first.
  // A concurrent change still produces a conflict rather than being overwritten.
  const snapshot = await client.call<ConversationSnapshot>("conversation.snapshot", { id, limit: 1 });
  return client.call<Conversation>("conversation.rename", { id, expected_revision: snapshot.conversation.revision, title: title.trim() });
}
