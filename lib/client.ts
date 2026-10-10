// HostClient speaks the zot continuous host protocol over WebSocket
// (`zot continuous serve --web`).
// One WebSocket message is one protocol frame. Calls are matched by request
// ID; watch frames are routed by watch ID. Closing the client never cancels
// host work.

export class HostError extends Error {
  constructor(
    public method: string,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

type Pending = { method: string; resolve: (v: unknown) => void; reject: (e: Error) => void };

type WatchHandlers = {
  onAck?: (data: Record<string, unknown>) => void;
  onFrame: (frame: Record<string, unknown>) => void;
  onEnd: (err?: HostError) => void;
};

export type ConnectionState = "connecting" | "open" | "closed";

export class HostClient {
  private ws: WebSocket;
  private next = 0;
  private calls = new Map<string, Pending>();
  private watches = new Map<string, WatchHandlers>();
  private closeListeners = new Set<(reason: string) => void>();
  role = "";
  version = "";

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (ev) => this.receive(String(ev.data));
    ws.onclose = (ev) => {
      const reason = ev.reason || `connection closed (${ev.code})`;
      const err = new HostError("connection", reason, "cancelled");
      for (const p of this.calls.values()) p.reject(err);
      this.calls.clear();
      for (const w of this.watches.values()) w.onEnd(err);
      this.watches.clear();
      for (const l of this.closeListeners) l(reason);
    };
  }

  static connect(url: string, token: string, timeoutMs = 10000): Promise<HostClient> {
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("timed out connecting to the host"));
      }, timeoutMs);
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`cannot reach ${url}`));
      };
      ws.onopen = () => {
        const client = new HostClient(ws);
        client
          .call<{ role: string; version: string }>("hello", { token })
          .then((data) => {
            clearTimeout(timer);
            client.role = data?.role ?? "";
            client.version = data?.version ?? "";
            resolve(client);
          })
          .catch((err) => {
            clearTimeout(timer);
            ws.close();
            reject(err);
          });
      };
    });
  }

  get open(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  onClose(listener: (reason: string) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  close() {
    this.closeListeners.clear();
    this.ws.close(1000, "client closed");
  }

  private id(): string {
    this.next += 1;
    return `w${this.next}`;
  }

  call<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = this.id();
    return new Promise<T>((resolve, reject) => {
      if (!this.open) {
        reject(new HostError(method, "not connected", "cancelled"));
        return;
      }
      this.calls.set(id, { method, resolve: resolve as (v: unknown) => void, reject });
      this.ws.send(JSON.stringify({ id, method, params: params ?? {} }));
    });
  }

  // watch opens a conversation watch. The returned function cancels it.
  watch(params: { id: string; after?: number; mode?: "commits" | "view" | "events" }, handlers: WatchHandlers): () => void {
    const id = this.id();
    this.watches.set(id, handlers);
    this.ws.send(JSON.stringify({ id, method: "conversation.watch", params }));
    return () => {
      if (!this.watches.delete(id)) return;
      if (this.open) this.call("watch.cancel", { watch_id: id }).catch(() => {});
    };
  }

  private receive(line: string) {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(line);
    } catch {
      return;
    }
    const type = frame.type as string;
    if (type === "response") {
      const id = frame.id as string;
      if (frame.method === "conversation.watch" && this.watches.has(id)) {
        const w = this.watches.get(id)!;
        if (frame.success) {
          w.onAck?.((frame.data as Record<string, unknown>) ?? {});
        } else {
          this.watches.delete(id);
          w.onEnd(new HostError("conversation.watch", String(frame.error ?? "watch failed"), String(frame.code ?? "error")));
        }
        return;
      }
      const p = this.calls.get(id);
      if (!p) return;
      this.calls.delete(id);
      if (frame.success) p.resolve(frame.data);
      else p.reject(new HostError(p.method, String(frame.error ?? "request failed"), String(frame.code ?? "error")));
      return;
    }
    const watchID = frame.watch_id as string | undefined;
    if (!watchID) return;
    const w = this.watches.get(watchID);
    if (!w) return;
    if (type === "watch_end") {
      this.watches.delete(watchID);
      w.onEnd();
      return;
    }
    w.onFrame(frame);
  }
}
