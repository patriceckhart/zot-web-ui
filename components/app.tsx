"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, Copy, FolderOpen, LogOut, PanelLeftClose, PanelLeftOpen, Pencil, Plus, RotateCcw, Search, Server, SquareTerminal, X } from "lucide-react";
import dynamic from "next/dynamic";
import { conversationRows } from "@/lib/conversation-tree";
import { HostClient } from "@/lib/client";
import type { Conversation, ConversationSnapshot, HostModel, RuntimeStatus, Submission } from "@/lib/protocol";
import { buildItems, formatTokens, isBusy, shortPath } from "@/lib/conversation";
import { useConversation } from "@/lib/use-conversation";
import {
  loadActiveHost,
  loadHosts,
  loadLabels,
  newID,
  saveActiveHost,
  saveHosts,
  saveLabel,
  loadTerminal,
  saveTerminal,
  loadWidth,
  saveWidth,
  loadNames,
  saveName,
  type HostProfile,
  type TerminalProfile,
} from "@/lib/storage";
import { ConnectScreen } from "./connect";
import { ResizeHandle } from "./resize-handle";
import { ContextMenu } from "./context-menu";
import { Composer, type Draft } from "./composer";
import { AnimatedZ } from "./animated-z";
import { Transcript } from "./transcript";
import { ApprovalBar } from "./approvals";
import { ModelDialog } from "./model-dialog";
import { WorkingSpinner } from "./working-spinner";
import { useConversationSearch } from "@/lib/use-search";
import { activityOf, useActivity, type Activity } from "@/lib/use-activity";
import { ActivityBadge } from "./activity-badge";

// xterm needs the browser, so the terminal is loaded on demand.
const TerminalView = dynamic(() => import("./terminal-view").then((m) => m.TerminalView), { ssr: false });

const REASONING = ["off", "minimum", "low", "medium", "high", "xhigh", "max"];

export function App() {
  const [ready, setReady] = useState(false);
  const [hosts, setHosts] = useState<HostProfile[]>([]);
  const [host, setHost] = useState<HostProfile | null>(null);
  const [client, setClient] = useState<HostClient | null>(null);
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  const connect = useCallback(async (h: HostProfile) => {
    setConnecting(true);
    setConnectError("");
    try {
      const c = await HostClient.connect(h.url, h.token);
      const st = await c.call<RuntimeStatus>("runtime.status").catch(() => null);
      c.onClose((reason) => {
        setClient(null);
        setConnectError(`Disconnected: ${reason}`);
      });
      setStatus(st);
      setHost(h);
      setClient(c);
      saveActiveHost(h.id);
    } catch (err) {
      setConnectError((err as Error).message);
      saveActiveHost(null);
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    // Session storage is only readable after mount; reading it during render
    // would break static prerendering.
    const stored = loadHosts();
    const active = loadActiveHost();
    /* eslint-disable react-hooks/set-state-in-effect */
    setHosts(stored);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const h = stored.find((x) => x.id === active);
    if (h) void connect(h);
  }, [connect]);

  const disconnect = () => {
    client?.close();
    setClient(null);
    setHost(null);
    saveActiveHost(null);
  };

  // Adding a host returns to the connect screen with the form open.
  const [addHost, setAddHost] = useState(false);

  if (!ready) return null;
  if (!client || !host) {
    return (
      <ConnectScreen
        key={addHost ? "add" : "list"}
        startAdding={addHost}
        hosts={hosts}
        error={connectError}
        connecting={connecting}
        onConnect={(h) => void connect(h)}
        onSave={(list) => {
          setHosts(list);
          saveHosts(list);
        }}
      />
    );
  }
  return (
    <Workspace
      key={host.id}
      client={client}
      host={host}
      hosts={hosts}
      status={status}
      onDisconnect={() => {
        setAddHost(false);
        disconnect();
      }}
      onSwitch={(h) => {
        // Close the current connection without reporting it as a failure.
        const old = client;
        setClient(null);
        setHost(null);
        old.close();
        void connect(h);
      }}
      onAddHost={() => {
        setAddHost(true);
        disconnect();
      }}
    />
  );
}

type WorkspaceProps = {
  client: HostClient;
  host: HostProfile;
  hosts: HostProfile[];
  status: RuntimeStatus | null;
  onDisconnect: () => void;
  onSwitch: (h: HostProfile) => void;
  onAddHost: () => void;
};

function Workspace({ client, host, hosts, status, onDisconnect, onSwitch, onAddHost }: WorkspaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  // User-chosen names, persisted per host URL in this browser.
  const [names, setNames] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [hostMenu, setHostMenu] = useState<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  // Terminals by conversation ID. An entry keeps its shell mounted (and
  // running) while other conversations are shown; visible controls the panel.
  const [terminals, setTerminals] = useState<Record<string, { visible: boolean }>>({});
  const [terminalSettings, setTerminalSettings] = useState<TerminalProfile | null>(() => loadTerminal(host.id));
  // Desktop widths of the side panels in pixels; phones use full-width overlays.
  const [sidebarWidth, setSidebarWidth] = useState(() => loadWidth("sidebar", 288));
  const [terminalWidth, setTerminalWidth] = useState(() => loadWidth("terminal", 640));
  const resizeSidebar = (w: number) => {
    setSidebarWidth(w);
    saveWidth("sidebar", w);
  };
  const resizeTerminal = (w: number) => {
    setTerminalWidth(w);
    saveWidth("terminal", w);
  };
  // Live state of the open chat, reported by ChatView from its watch.
  const [liveActivity, setLiveActivity] = useState<{ id: string; activity: Activity } | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [listError, setListError] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const all: Conversation[] = [];
      let after = "";
      for (let page = 0; page < 20; page++) {
        const res = await client.call<{ conversations: Conversation[]; after: string }>("conversation.list", { after, limit: 200 });
        all.push(...res.conversations);
        if (res.conversations.length < 200) break;
        after = res.after;
      }
      all.sort((a, b) => b.created.localeCompare(a.created));
      setConversations(all);
      setListError("");
    } catch (err) {
      setListError((err as Error).message);
    }
  }, [client]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLabels(loadLabels());
    setNames(loadNames(host.url));
    if (window.innerWidth < 768) setSidebar(false);
    void refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh, host.url]);

  const open = async (workspace: string) => {
    const name = workspace.trim();
    if (!name) return;
    const c = await client.call<Conversation>("conversation.create", { workspace: name });
    saveLabel(c.id, name);
    setLabels(loadLabels());
    setCreating(false);
    setActive(c.id);
    if (window.innerWidth < 768) setSidebar(false);
    void refresh();
  };

  const rename = (id: string, name: string) => {
    saveName(host.url, id, name);
    setNames(loadNames(host.url));
    setRenaming(null);
  };

  const title = (c: Conversation) => names[c.id] ?? labels[c.id] ?? (c.owner ? `subagent ${c.id.slice(0, 8)}` : c.parent ? `fork ${c.id.slice(0, 8)}` : `conversation ${c.id.slice(0, 8)}`);

  const rows = useMemo(() => conversationRows(conversations, collapsed), [conversations, collapsed]);
  const toggleChildren = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const search = useConversationSearch(client, conversations, filter);
  const polled = useActivity(client, conversations);
  const activityFor = (id: string): Activity | undefined => (liveActivity?.id === id ? liveActivity.activity : polled[id]);
  // Name matches are found locally; content matches come from the host.
  const q = filter.trim().toLowerCase();
  const nameMatches = search.active ? conversations.filter((c) => title(c).toLowerCase().includes(q) && !search.matches.some((m) => m.conversation.id === c.id)) : [];
  const setTerminalVisible = (id: string, visible: boolean) => setTerminals((t) => ({ ...t, [id]: { visible } }));
  const closeTerminal = (id: string) =>
    setTerminals((t) => {
      const next = { ...t };
      delete next[id];
      return next;
    });

  const pick = (id: string) => {
    setActive(id);
    if (window.innerWidth < 768) setSidebar(false);
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden pr-[env(safe-area-inset-right)]">
      {sidebar && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebar(false)} />}
      <aside
        style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
        className={`fixed inset-y-0 left-0 z-30 flex w-[calc(18rem+env(safe-area-inset-left))] max-w-[85vw] flex-col border-r border-border bg-sidebar pt-[var(--top-inset)] pl-[env(safe-area-inset-left)] transition-transform md:relative md:z-auto md:w-[var(--sidebar-w)] md:max-w-none md:shrink-0 ${sidebar ? "translate-x-0" : "-translate-x-full md:hidden"}`}
      >
        <ResizeHandle edge="right" width={sidebarWidth} min={200} max={() => Math.min(560, window.innerWidth * 0.4)} label="Resize sidebar" onResize={resizeSidebar} />
        <div className="flex items-center gap-2 px-4 py-4">
          <AnimatedZ width={24} height={24} />
          <div className="flex-1" />
          <button
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
            aria-label="New session"
            title="New session"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" />
            {sidebarWidth >= 260 && <span>new session</span>}
          </button>
          <button className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Hide sidebar" onClick={() => setSidebar(false)}>
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        <label className="mx-3 mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground focus-within:bg-accent">
          <Search className="h-4 w-4" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setFilter("")}
            placeholder="Search conversations"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {filter && (
            <button aria-label="Clear search" className="hover:text-foreground" onClick={() => setFilter("")}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {listError && <p className="px-2 py-1 text-xs text-destructive">{listError}</p>}
          {creating && <NewSession onOpen={open} onCancel={() => setCreating(false)} />}
          {search.active ? (
            <>
              <div className="flex items-center gap-2 px-2 pb-1 text-xs text-muted-foreground">
                {search.searching ? <WorkingSpinner label="searching" /> : <span>{plural(search.matches.length + nameMatches.length, "matching conversation")}</span>}
              </div>
              {search.error && <p className="px-2 py-1 text-xs text-destructive">{search.error}</p>}
              {search.matches.map((m) => (
                <button
                  key={m.conversation.id}
                  onClick={() => pick(m.conversation.id)}
                  className={`flex w-full flex-col border-l-2 px-2 py-2 text-left ${active === m.conversation.id ? "border-zot bg-accent" : "border-transparent hover:bg-accent/60"}`}
                >
                  <span className="flex items-center gap-2 text-[0.8rem]">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{shortPath(title(m.conversation))}</span>
                    <ActivityBadge activity={activityFor(m.conversation.id)} />
                    <span className="shrink-0 text-xs text-zot">
                      {m.count}
                      {m.more ? "+" : ""}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 pl-5.5 text-xs text-muted-foreground">
                    <Highlight text={m.snippet} needle={filter.trim()} />
                  </span>
                </button>
              ))}
              {nameMatches.map((c) => (
                <SessionRow key={c.id} c={c} title={title(c)} activity={activityFor(c.id)} active={active === c.id} onClick={() => pick(c.id)} onMenu={(x, y) => setRowMenu({ id: c.id, x, y })} />
              ))}
            </>
          ) : (
            rows.map(({ conversation: c, depth, hasChildren }) => (
              <div key={c.id} className="flex items-start" style={{ marginLeft: Math.min(depth, 6) * 12 }}>
                {hasChildren ? (
                  <button
                    className="mt-2 shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`${collapsed.has(c.id) ? "Expand" : "Collapse"} subagents of ${title(c)}`}
                    aria-expanded={!collapsed.has(c.id)}
                    onClick={() => toggleChildren(c.id)}
                  >
                    {collapsed.has(c.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                ) : <span className="w-5.5 shrink-0" />}
                {renaming === c.id ? (
                  <RenameRow initial={names[c.id] ?? title(c)} onSave={(n) => rename(c.id, n)} onCancel={() => setRenaming(null)} />
                ) : (
                  <SessionRow
                    c={c}
                    title={title(c)}
                    activity={activityFor(c.id)}
                    active={active === c.id}
                    onClick={() => pick(c.id)}
                    onMenu={(x, y) => setRowMenu({ id: c.id, x, y })}
                  />
                )}
              </div>
            ))
          )}
          {!search.active && conversations.length === 0 && !creating && <p className="px-2 py-4 text-sm text-muted-foreground">No sessions yet.</p>}
        </nav>
        <div className="flex items-center gap-1 border-t border-border px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
          <button
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-accent hover:text-foreground"
            title={`${host.url}\nSwitch or add hosts`}
            aria-haspopup="menu"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHostMenu({ x: r.left, y: r.top });
            }}
          >
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            <span className="truncate">
              {host.name}
              {status?.version ? ` (${status.version})` : ""}
            </span>
            <ArrowLeftRight className="ml-auto h-3.5 w-3.5 shrink-0" />
          </button>
          <button className="rounded p-1.5 hover:text-foreground" aria-label="Disconnect" title="Disconnect" onClick={onDisconnect}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col pl-[env(safe-area-inset-left)] md:pl-0">
        {active ? (
          <ChatView
            key={active}
            client={client}
            id={active}
            title={conversations.find((c) => c.id === active) ? title(conversations.find((c) => c.id === active)!) : active.slice(0, 8)}
            attachments={!!status?.capabilities?.attachments}
            models={!!status?.capabilities?.models}
            providers={!!status?.capabilities?.providers}
            sidebarOpen={sidebar}
            onMenu={() => setSidebar((s) => !s)}
            onActivity={setLiveActivity}
            terminalOpen={!!terminals[active]?.visible}
            onTerminal={() => setTerminalVisible(active, !terminals[active]?.visible)}
          />
        ) : (
          <Landing sidebarOpen={sidebar} onMenu={() => setSidebar((s) => !s)} onOpen={open} />
        )}
      </main>
      {rowMenu && (
        <ContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          label="Conversation"
          onDismiss={() => setRowMenu(null)}
          items={[
            { label: "Rename", icon: <Pencil className="h-4 w-4 text-muted-foreground" />, run: () => setRenaming(rowMenu.id) },
            {
              label: "Reset name",
              icon: <RotateCcw className="h-4 w-4 text-muted-foreground" />,
              run: () => rename(rowMenu.id, ""),
              disabled: !names[rowMenu.id],
            },
            "separator",
            { label: "Copy ID", icon: <Copy className="h-4 w-4 text-muted-foreground" />, run: () => void navigator.clipboard?.writeText(rowMenu.id) },
          ]}
        />
      )}
      {hostMenu && (
        <ContextMenu
          x={hostMenu.x}
          y={hostMenu.y - 8}
          label="Hosts"
          onDismiss={() => setHostMenu(null)}
          items={[
            ...hosts.map((h) => ({
              label: h.name,
              icon: h.id === host.id ? <Check className="h-4 w-4 text-zot" /> : <Server className="h-4 w-4 text-muted-foreground" />,
              run: () => h.id !== host.id && onSwitch(h),
            })),
            "separator" as const,
            { label: "Add host", icon: <Plus className="h-4 w-4 text-muted-foreground" />, run: onAddHost },
            { label: "Disconnect", icon: <LogOut className="h-4 w-4 text-muted-foreground" />, run: onDisconnect },
          ]}
        />
      )}
      {Object.entries(terminals).map(([id, t]) => {
        const shown = id === active && t.visible;
        return (
          <aside
            key={id}
            aria-label="Terminal"
            hidden={!shown}
            style={{ "--terminal-w": `${terminalWidth}px` } as React.CSSProperties}
            className="fixed inset-0 z-40 flex flex-col border-l border-border bg-background pr-[env(safe-area-inset-right)] md:relative md:inset-auto md:z-auto md:w-[min(var(--terminal-w),calc(100vw-20rem))] md:shrink-0 md:pr-0"
          >
            <ResizeHandle edge="left" width={terminalWidth} min={280} max={() => window.innerWidth - 320 - (sidebar ? sidebarWidth : 0)} label="Resize terminal" onResize={resizeTerminal} />
            <TerminalView
              settings={terminalSettings}
              onSettings={(s) => {
                saveTerminal(host.id, s);
                setTerminalSettings(s);
              }}
              onHide={() => setTerminalVisible(id, false)}
              onClose={() => closeTerminal(id)}
            />
          </aside>
        );
      })}
    </div>
  );
}

function SessionRow({ c, title, activity, active, onClick, onMenu }: { c: Conversation; title: string; activity?: Activity; active: boolean; onClick: () => void; onMenu: (x: number, y: number) => void }) {
  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY);
      }}
      className={`flex w-full min-w-0 flex-col rounded-md px-2 py-2 text-left ${active ? "rule-l bg-accent" : "border-l-2 border-transparent hover:bg-accent/60"}`}>
      <span className="flex items-center gap-2 text-sm">
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-[0.8rem]">{shortPath(title)}</span>
      </span>
      <span className="mt-0.5 flex gap-2 pl-5.5 text-xs text-muted-foreground">
        <span className="truncate">{c.config.model || "default model"}</span>
        <span className="ml-auto shrink-0">{activity && activity !== "idle" ? <ActivityBadge activity={activity} /> : relativeTime(c.created)}</span>
      </span>
    </button>
  );
}

function RenameRow({ initial, onSave, onCancel }: { initial: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex w-full min-w-0 items-center gap-1 rounded-md bg-accent px-2 py-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        onBlur={() => onSave(value)}
        maxLength={120}
        aria-label="Conversation name"
        className="min-w-0 flex-1 bg-transparent font-mono text-[0.8rem] outline-none"
      />
    </form>
  );
}

function NewSession({ onOpen, onCancel }: { onOpen: (w: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState("main");
  const [error, setError] = useState("");
  return (
    <form
      className="mb-2 rounded-md border border-border p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onOpen(value).catch((err) => setError((err as Error).message));
      }}
    >
      <label className="mb-1 block text-xs text-muted-foreground">Workspace</label>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1 font-mono text-sm outline-none focus:border-primary" />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" className="rounded border border-zot text-zot px-2.5 py-1 text-xs hover:bg-zot hover:text-black">Open</button>
        <button type="button" onClick={onCancel} className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </form>
  );
}

function Landing({ sidebarOpen, onMenu, onOpen }: { sidebarOpen: boolean; onMenu: () => void; onOpen: (w: string) => Promise<void> }) {
  const [workspace, setWorkspace] = useState("main");
  const [error, setError] = useState("");
  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-[57px] items-center px-4 pt-[var(--top-inset)]">
        <SidebarToggle open={sidebarOpen} onClick={onMenu} />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <AnimatedZ width={72} height={72} />
        <form
          className="flex items-center gap-2 text-sm text-muted-foreground"
          onSubmit={(e) => {
            e.preventDefault();
            onOpen(workspace).catch((err) => setError((err as Error).message));
          }}
        >
          <FolderOpen className="h-4 w-4" />
          <input
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            className="dotted-link w-40 bg-transparent text-center font-mono text-foreground outline-none"
            aria-label="Workspace"
          />
          <button type="submit" className="rounded border border-zot text-zot px-3 py-1 text-xs hover:bg-zot hover:text-black">Open</button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          A workspace is a named root conversation on the host. Opening the same name again continues it, also from the terminal with <code className="font-mono">--continuous-workspace</code>.
        </p>
      </div>
    </div>
  );
}

function ChatView({ client, id, title, attachments, models, providers, sidebarOpen, onMenu, onActivity, terminalOpen, onTerminal }: { client: HostClient; id: string; title: string; attachments: boolean; models: boolean; providers: boolean; sidebarOpen: boolean; onMenu: () => void; onActivity: (a: { id: string; activity: Activity } | null) => void; terminalOpen: boolean; onTerminal: () => void }) {
  const { state, error } = useConversation(client, id);
  const [actionError, setActionError] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const items = useMemo(() => (state ? buildItems(state) : []), [state]);
  const busy = state ? isBusy(state) : false;
  const liveActivity = state ? activityOf({ chain: state.chain, approvals: [...state.approvals.values()], queue: [...state.queue.values()] }) : null;
  useEffect(() => {
    onActivity(liveActivity ? { id, activity: liveActivity } : null);
  }, [id, liveActivity, onActivity]);
  useEffect(() => () => onActivity(null), [onActivity]);
  const canAbort = client.role === "admin";
  const canSubmit = client.role !== "read";
  const provider = state?.config.provider;
  const loadModels = useMemo(
    () => (models ? () => client.call<{ models: HostModel[] }>("model.list", providers ? { available: true } : { provider }).then((r) => r.models ?? []) : undefined),
    [client, models, provider, providers],
  );

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  const submit = async (draft: Draft, steer: boolean): Promise<boolean> => {
    setActionError("");
    try {
      await client.call<Submission>("conversation.submit", {
        id,
        content: draft.text,
        request_id: newID(),
        policy: steer ? "steer" : "queue",
        ...(draft.images.length ? { images: draft.images } : {}),
        ...(draft.files.length ? { files: draft.files } : {}),
      });
      pinned.current = true;
      return true;
    } catch (err) {
      setActionError((err as Error).message);
      return false;
    }
  };

  const abort = () => {
    client.call("conversation.abort", { id }).catch((err) => setActionError((err as Error).message));
  };

  const contextTokens = state?.lastModelUsage ? state.lastModelUsage.usage.input_tokens + state.lastModelUsage.usage.cache_read_tokens + state.lastModelUsage.usage.cache_write_tokens : 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 pb-3 pt-[max(0.75rem,var(--top-inset))]">
        <SidebarToggle open={sidebarOpen} onClick={onMenu} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-medium">{shortPath(title)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {busy ? (state?.approvals.size ? "awaiting approval" : "working") : state?.queue.size ? `${state.queue.size} queued` : "idle"}
            {state?.queueHeld ? " (queue held after failure)" : ""}
          </div>
        </div>
        <button
          className={`rounded p-1 hover:text-foreground ${terminalOpen ? "text-zot" : "text-muted-foreground"}`}
          aria-label={terminalOpen ? "Hide terminal" : "Show terminal"}
          aria-pressed={terminalOpen}
          title={terminalOpen ? "Hide terminal" : "Terminal"}
          onClick={onTerminal}
        >
          <SquareTerminal className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={scroller}
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          {!state && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          {state?.more && <p className="mb-6 text-center text-xs text-muted-foreground">Older history is on the host and not shown here.</p>}
          <Transcript items={items} />
          {busy && (
            <div className="mt-4">
              <WorkingSpinner label={state?.approvals.size ? "awaiting approval" : "working"} />
            </div>
          )}
          {state && state.queue.size > 0 && (
            <div className="mt-6 space-y-2">
              {[...state.queue.values()].map((q) => (
                <div key={q.id} className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                  <span className="text-xs">{q.policy === "steer" ? "steer" : "queued"}</span>
                  <span className="max-w-[70%] truncate rounded-lg border border-dashed border-border px-3 py-1.5">{q.content || "(attachments)"}</span>
                  {canAbort && (
                    <button aria-label="Withdraw" className="hover:text-foreground" onClick={() => client.call("submission.withdraw", { id: q.id }).catch((err) => setActionError((err as Error).message))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        {state && state.approvals.size > 0 && <ApprovalBar client={client} approvals={[...state.approvals.values()]} onError={setActionError} />}
        {actionError && <p className="px-4 pt-2 text-sm text-destructive">{actionError}</p>}
        <Composer
          busy={busy}
          disabled={!state || !canSubmit}
          canAbort={canAbort}
          attachments={attachments}
          placeholder={canSubmit ? undefined : "Read-only token"}
          onSubmit={submit}
          onAbort={abort}
        />
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button className="dotted-link truncate hover:text-foreground" onClick={() => setModelOpen(true)} disabled={!state || !canSubmit}>
            {state?.config.model || "default model"}
            {state?.config.reasoning && state.config.reasoning !== "off" ? `, ${state.config.reasoning}` : ""}
          </button>
          <div className="flex-1" />
          {contextTokens > 0 && <span title="Context tokens of the last request">{formatTokens(contextTokens)} ctx</span>}
          {state && <span className="font-mono">${state.usage.cost_usd.toFixed(state.usage.cost_usd < 1 ? 3 : 2)}</span>}
        </div>
      </div>

      {modelOpen && state && (
        <ModelDialog
          config={state.config}
          reasoningLevels={REASONING}
          loadModels={loadModels}
          onClose={() => setModelOpen(false)}
          onSave={async (config) => {
            const snap = await client.call<ConversationSnapshot>("conversation.snapshot", { id, limit: 1 });
            await client.call("conversation.configure", { id, expected_revision: snap.conversation.revision, config });
            setModelOpen(false);
          }}
          onCompact={async () => {
            await client.call("conversation.compact", { id });
            setModelOpen(false);
          }}
        />
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!t) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// Highlight marks case-insensitive occurrences of needle in text.
function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === needle.toLowerCase() ? (
          <mark key={i} className="bg-zot/20 text-zot">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

// SidebarToggle opens the sidebar. On desktop it is hidden while the sidebar
// is open, because the sidebar has its own close button in the same row.
function SidebarToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      className={`rounded p-1 text-muted-foreground hover:text-foreground ${open ? "md:hidden" : ""}`}
      aria-label="Show sidebar"
      onClick={onClick}
    >
      <PanelLeftOpen className="h-4 w-4" />
    </button>
  );
}
