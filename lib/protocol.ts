// Types of the zot continuous host protocol, as served by
// `zot continuous serve` (packages/continuous/hostrpc.go). Only the fields
// the web UI reads are declared.

export type AgentConfig = {
  provider: string;
  model: string;
  reasoning?: string;
  instructions?: string;
  tools?: string[];
  deny_tools?: string[];
  extensions?: string[];
  parallel_tools?: boolean;
  steer_mode?: string;
  follow_up_mode?: string;
};

export type Conversation = {
  id: string;
  title?: string;
  created: string;
  revision: number;
  config: AgentConfig;
  entry_sequence?: number;
  queue_held?: boolean;
  parent?: { conversation_id: string; at: number };
  owner?: { conversation_id: string; id: string };
};

export type ImageBlock = { mime_type: string; data: string };

export type Entry = {
  id: string;
  conversation_id: string;
  submission_id: string;
  revision: number;
  type: string;
  content: string;
  images?: ImageBlock[];
  message?: ProviderMessage;
  time?: string;
};

export type ContentBlock = {
  type?: string;
  text?: string;
  format?: string;
  mime_type?: string;
  data?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
  server?: boolean;
  call_id?: string;
  content?: ContentBlock[];
  is_error?: boolean;
  reasoning_id?: string;
  summary?: string;
  encrypted_content?: string;
};

export type ProviderMessage = {
  role: "user" | "assistant" | "tool";
  content: ContentBlock[];
  time?: string;
};

export type Submission = {
  id: string;
  conversation_id: string;
  content: string;
  state: string;
  policy?: string;
  kind?: string;
};

export type Partial = {
  conversation_id: string;
  run_id: string;
  turn: number;
  attempt: number;
  text: string;
  final?: boolean;
  truncated?: boolean;
};

export type Task = {
  id: string;
  conversation_id: string;
  kind: string;
  input?: { run_id?: string; call_id?: string; name?: string; args?: unknown };
  state: string;
  phase?: string;
  checkpoint?: { args?: unknown };
  outcome?: string;
  error?: string;
  last_error?: string;
  effect?: string;
};

export type ToolProgress = { task_id: string; call_id: string; text: string; truncated?: boolean };

export type Approval = {
  id: string;
  conversation_id: string;
  call_id: string;
  tool: string;
  args: unknown;
  summary?: string;
  state: string;
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
};

export type UsageTotals = { usage: Usage; known: number; unknown: number };

export type UsageRecord = {
  run_id: string;
  provider: string;
  model: string;
  usage: Usage;
  status: string;
  source: string;
  tool?: string;
};

export type Chain = { conversation_id: string; run_id: string; task: string; started: string };

export type Run = {
  id: string;
  phase: string;
  outcome?: string;
  error?: string;
  notices?: string[];
};

export type ConversationSnapshot = {
  revision: number;
  conversation: Conversation;
  entries: Entry[];
  queue: Submission[];
  run?: Run;
  usage: UsageTotals;
  tasks?: Task[];
  approvals?: Approval[];
  partial?: Partial;
  chain?: Chain;
  progress?: ToolProgress[];
  more?: boolean;
};

export type ViewOp = {
  doc: "execution" | "queue" | "usage" | "metadata" | "agent" | "provider" | "entries" | "partial" | "progress" | "approvals";
  op: "put" | "delete";
  key?: string;
  value?: unknown;
};

export type ViewChange = { revision: number; actor?: string; ops: ViewOp[] };

export type SearchResult = {
  revision: number;
  hits: { owner: string; sequence: number; entry: Entry }[];
  more: boolean;
};

export type RuntimeStatus = {
  version?: string;
  capabilities?: { attachments?: boolean; models?: boolean; providers?: boolean };
  metrics?: Record<string, unknown>;
};

export type FileAttachment = { name: string; data: string };

export type HostModel = {
  provider?: string;
  id: string;
  display_name?: string;
  context_window?: number;
  max_output?: number;
  reasoning: boolean;
};
