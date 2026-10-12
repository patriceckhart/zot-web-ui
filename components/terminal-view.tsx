"use client";

import { useEffect, useRef, useState } from "react";
import { PanelBottom, PanelLeft, PanelRight, PanelRightClose, PanelTop, RotateCcw, Settings2, X } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import { ContextMenu } from "./context-menu";
import { ctrlKey, KEYS, terminalURL } from "@/lib/terminal";
import { layout, leaf, leaves, remove, setRatio, split, type Path, type Side, type SplitTree } from "@/lib/split";

export type TerminalSettings = { url: string; token: string };

type Status = "connecting" | "ready" | "exited" | "error";

type Props = {
  settings: TerminalSettings | null;
  onSettings: (s: TerminalSettings) => void;
  // onHide hides the panel and keeps the shells running.
  onHide: () => void;
  // onClose ends all shells of the panel.
  onClose: () => void;
};

const MAX_PANES = 8;

// TerminalView shows shells from the zotty bridge running on the host. It
// stays mounted while hidden so the shells survive switching conversations.
// Right-clicking a pane splits it.
export function TerminalView({ settings, onSettings, onHide, onClose }: Props) {
  const [editing, setEditing] = useState(!settings);
  const [tree, setTree] = useState<SplitTree>(() => leaf(newID()));
  // Bumping a pane's generation restarts its shell.
  const [gens, setGens] = useState<Record<string, number>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const count = leaves(tree).length;
  const restart = (id: string) => setGens((g) => ({ ...g, [id]: (g[id] ?? 0) + 1 }));
  const restartAll = () => setGens((g) => Object.fromEntries(leaves(tree).map((id) => [id, (g[id] ?? 0) + 1])));
  const iconButton = "rounded p-1 text-muted-foreground hover:text-foreground";
  const ic = "h-4 w-4 text-muted-foreground";

  const splitPane = (id: string, side: Side) => {
    if (count >= MAX_PANES) return;
    const added = newID();
    setTree((t) => split(t, id, side, added));
    setFocused(added);
  };
  const closePane = (id: string) => {
    const next = remove(tree, id);
    if (!next) {
      onClose();
      return;
    }
    setTree(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 pb-3 pt-[max(0.75rem,var(--top-inset))]">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm font-medium">terminal</div>
          <div className="text-xs text-muted-foreground">zotty{count > 1 ? `, ${count} panes` : ""}</div>
        </div>
        {settings && !editing && (
          <>
            <button className={iconButton} aria-label="New shell" title={count > 1 ? "Restart all shells" : "New shell"} onClick={restartAll}>
              <RotateCcw className="h-4 w-4" />
            </button>
            <button className={iconButton} aria-label="Terminal settings" title="Terminal settings" onClick={() => setEditing(true)}>
              <Settings2 className="h-4 w-4" />
            </button>
          </>
        )}
        <button className={iconButton} aria-label="Hide terminal" title="Hide terminal (shells keep running)" onClick={onHide}>
          <PanelRightClose className="h-4 w-4" />
        </button>
        <button className={iconButton} aria-label="Close terminal" title="Close terminal (ends all shells)" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </header>
      {editing || !settings ? (
        <TerminalSetup
          initial={settings}
          onSave={(s) => {
            onSettings(s);
            setEditing(false);
            restartAll();
          }}
          onCancel={settings ? () => setEditing(false) : undefined}
        />
      ) : (
        <div ref={area} className="relative min-h-0 flex-1">
          <SplitArea
            tree={tree}
            container={area}
            onResize={(path, ratio) => setTree((t) => setRatio(t, path, ratio))}
            pane={(id) => (
              <div
                className={`flex h-full min-h-0 flex-col ${count > 1 && focused === id ? "ring-1 ring-inset ring-zot/50" : ""}`}
                onFocusCapture={() => setFocused(id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id, x: e.clientX, y: e.clientY });
                }}
              >
                <TerminalSession key={`${id}:${gens[id] ?? 0}`} settings={settings} onRestart={() => restart(id)} />
              </div>
            )}
          />
          {menu && (
            <ContextMenu
              x={menu.x}
              y={menu.y}
              label="Terminal pane"
              onDismiss={() => setMenu(null)}
              items={[
                { label: "Split left", icon: <PanelLeft className={ic} />, run: () => splitPane(menu.id, "left"), disabled: count >= MAX_PANES },
                { label: "Split right", icon: <PanelRight className={ic} />, run: () => splitPane(menu.id, "right"), disabled: count >= MAX_PANES },
                { label: "Split top", icon: <PanelTop className={ic} />, run: () => splitPane(menu.id, "top"), disabled: count >= MAX_PANES },
                { label: "Split bottom", icon: <PanelBottom className={ic} />, run: () => splitPane(menu.id, "bottom"), disabled: count >= MAX_PANES },
                "separator",
                { label: "Restart shell", icon: <RotateCcw className={ic} />, run: () => restart(menu.id) },
                { label: "Close pane", icon: <X className={ic} />, run: () => closePane(menu.id) },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}

// SplitArea positions panes absolutely from the layout. Panes are rendered as
// a flat, ID-keyed list so splitting or closing never remounts other shells.
function SplitArea({
  tree,
  container,
  onResize,
  pane,
}: {
  tree: SplitTree;
  container: React.RefObject<HTMLDivElement | null>;
  onResize: (path: Path, ratio: number) => void;
  pane: (id: string) => React.ReactNode;
}) {
  const l = layout(tree);
  const pct = (v: number) => `${v * 100}%`;
  // Render in a fixed order (by ID), independent of the tree, so a new pane
  // is only inserted and existing terminals are never moved in the DOM.
  const panes = [...l.panes].sort((a, b) => (a.id < b.id ? -1 : 1));
  return (
    <>
      {panes.map(({ id, rect }) => (
        <div key={id} className="absolute overflow-hidden" style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}>
          {pane(id)}
        </div>
      ))}
      {l.dividers.map((d) => {
        const row = d.dir === "row";
        return (
          <div
            key={d.path.join("") || "root"}
            role="separator"
            aria-orientation={row ? "vertical" : "horizontal"}
            className={`group absolute z-10 flex touch-none items-center justify-center ${row ? "-ml-1 w-2 cursor-col-resize" : "-mt-1 h-2 cursor-row-resize"}`}
            style={{ left: pct(d.rect.x), top: pct(d.rect.y), width: row ? undefined : pct(d.rect.w), height: row ? pct(d.rect.h) : undefined }}
            onPointerDown={(e) => {
              const el = container.current;
              if (!el) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              const box = el.getBoundingClientRect();
              const move = (ev: PointerEvent) => {
                const ratio = row
                  ? ((ev.clientX - box.left) / box.width - d.parent.x) / d.parent.w
                  : ((ev.clientY - box.top) / box.height - d.parent.y) / d.parent.h;
                onResize(d.path, ratio);
              };
              const target = e.currentTarget;
              const up = () => {
                target.removeEventListener("pointermove", move);
                target.removeEventListener("pointerup", up);
                target.removeEventListener("pointercancel", up);
              };
              target.addEventListener("pointermove", move);
              target.addEventListener("pointerup", up);
              target.addEventListener("pointercancel", up);
            }}
          >
            <span className={`bg-border group-hover:bg-zot ${row ? "h-full w-px" : "h-px w-full"}`} />
          </div>
        );
      })}
    </>
  );
}

function newID(): string {
  return Math.random().toString(36).slice(2, 10);
}

function TerminalSession({ settings, onRestart }: { settings: TerminalSettings; onRestart: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(data: string) => void>(() => {});
  const focusRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<Status>("connecting");
  const [message, setMessage] = useState("");
  const [ctrl, setCtrl] = useState(false);
  const ctrlRef = useRef(false);
  const setCtrlMode = (on: boolean) => {
    ctrlRef.current = on;
    setCtrl(on);
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let disposed = false;
    let ws: WebSocket | null = null;
    let cleanup = () => {};

    void (async () => {
      // xterm touches window on import, so load it only in the browser.
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed) return;
      const css = getComputedStyle(document.documentElement);
      const color = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      const term = new Terminal({
        cursorBlink: true,
        fontFamily: css.getPropertyValue("--font-mono").trim() || "ui-monospace, monospace",
        fontSize: window.innerWidth < 640 ? 12 : 13,
        scrollback: 5000,
        theme: {
          background: color("--background", "#0a0a0a"),
          foreground: color("--foreground", "#ededed"),
          cursor: color("--zot", "#7dd3fc"),
          selectionBackground: "#7dd3fc40",
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(el);
      fit.fit();
      focusRef.current = () => term.focus();

      const enc = new TextEncoder();
      const send = (data: string) => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(enc.encode(data));
      };
      sendRef.current = send;
      const input = term.onData((data) => {
        if (ctrlRef.current) {
          ctrlRef.current = false;
          setCtrl(false);
          data = ctrlKey(data);
        }
        send(data);
      });
      const resize = () => {
        // A hidden panel has no size. Fitting it would shrink the shell to
        // a minimum, so wait until it is visible again.
        if (el.clientWidth === 0 || el.clientHeight === 0) return;
        fit.fit();
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      };
      const observer = new ResizeObserver(() => resize());
      observer.observe(el);

      let url: string;
      try {
        url = terminalURL(settings.url);
      } catch (err) {
        setStatus("error");
        setMessage((err as Error).message);
        cleanup = () => {
          observer.disconnect();
          input.dispose();
          term.dispose();
        };
        return;
      }
      const socket = new WebSocket(url);
      ws = socket;
      socket.binaryType = "arraybuffer";
      let opened = false;
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "auth", token: settings.token, cols: term.cols, rows: term.rows }));
      };
      socket.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(ev.data));
          return;
        }
        try {
          const msg = JSON.parse(ev.data as string) as { type: string; code?: number };
          if (msg.type === "ready") {
            opened = true;
            setStatus("ready");
            setMessage("");
            term.focus();
          } else if (msg.type === "exit") {
            setStatus("exited");
            setMessage(`shell exited${msg.code ? ` with code ${msg.code}` : ""}`);
          }
        } catch {
          // Ignore malformed control frames.
        }
      };
      socket.onclose = (ev) => {
        if (disposed) return;
        setStatus((s) => (s === "exited" ? s : "error"));
        setMessage((m) => {
          if (m) return m;
          if (ev.code === 1008) return "unauthorized: check the terminal token";
          if (ev.code === 1013) return "too many open shells on the host";
          return opened ? "connection closed" : "cannot reach zotty at this URL";
        });
      };
      cleanup = () => {
        observer.disconnect();
        input.dispose();
        socket.close();
        term.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [settings]);

  const key = (data: string) => {
    sendRef.current(data);
    focusRef.current();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {status !== "ready" && (
        <div className={`flex items-center gap-3 border-b border-border px-4 py-2 text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          <span className="flex-1">{status === "connecting" ? "connecting..." : message}</span>
          {status !== "connecting" && (
            <button className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent" onClick={onRestart}>
              reconnect
            </button>
          )}
        </div>
      )}
      <div ref={box} className="min-h-0 flex-1 overflow-hidden px-2 pt-2" />
      <div className="flex gap-1 overflow-x-auto border-t border-border px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden">
        <KeyButton label="esc" onPress={() => key(KEYS.esc)} />
        <KeyButton label="tab" onPress={() => key(KEYS.tab)} />
        <KeyButton
          label="ctrl"
          active={ctrl}
          onPress={() => {
            setCtrlMode(!ctrlRef.current);
            focusRef.current();
          }}
        />
        <KeyButton label="←" onPress={() => key(KEYS.left)} />
        <KeyButton label="↑" onPress={() => key(KEYS.up)} />
        <KeyButton label="↓" onPress={() => key(KEYS.down)} />
        <KeyButton label="→" onPress={() => key(KEYS.right)} />
      </div>
    </div>
  );
}

function KeyButton({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      // Keep focus (and the on-screen keyboard) in the terminal.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={`min-w-10 rounded border px-2 py-1 font-mono text-xs ${active ? "border-zot text-zot" : "border-border text-muted-foreground"}`}
    >
      {label}
    </button>
  );
}

function TerminalSetup({ initial, onSave, onCancel }: { initial: TerminalSettings | null; onSave: (s: TerminalSettings) => void; onCancel?: () => void }) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [token, setToken] = useState(initial?.token ?? "");
  const [error, setError] = useState("");
  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 py-10">
      <form
        className="w-full max-w-md space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            terminalURL(url);
          } catch (err) {
            setError((err as Error).message);
            return;
          }
          onSave({ url: url.trim(), token: token.trim() });
        }}
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          The terminal connects to <span className="text-zot">zotty</span>, a separate bridge on the host. It gives full shell access as the user running it, so keep it on localhost and expose it only through a private tunnel such as Tailscale.
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Terminal URL</span>
          <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https:// or wss://" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Terminal token</span>
          <input className={inputClass} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" required minLength={16} />
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-md border border-zot px-4 py-2 text-sm text-zot hover:bg-zot hover:text-black">
            Connect
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
          )}
        </div>
        <pre className="overflow-x-auto rounded-md border border-border p-3 text-xs text-muted-foreground">zotty serve --listen 127.0.0.1:7789</pre>
      </form>
    </div>
  );
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary";
