"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { AgentConfig, HostModel } from "@/lib/protocol";
import { formatTokens } from "@/lib/conversation";

type Props = {
  config: AgentConfig;
  reasoningLevels: string[];
  // loadModels lists the host catalog for the conversation's provider. It is
  // undefined for hosts without model.list; the model is then typed in.
  loadModels?: () => Promise<HostModel[]>;
  onClose: () => void;
  onSave: (config: AgentConfig) => Promise<void>;
  onCompact: () => Promise<void>;
};

export function ModelDialog({ config, reasoningLevels, loadModels, onClose, onSave, onCompact }: Props) {
  const [model, setModel] = useState(config.model);
  const [reasoning, setReasoning] = useState(config.reasoning || "off");
  const [instructions, setInstructions] = useState(config.instructions ?? "");
  const [models, setModels] = useState<HostModel[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!loadModels) return;
    let cancelled = false;
    loadModels()
      .then((list) => !cancelled && setModels(list))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, [loadModels]);

  // Bring the current model into view once the catalog has loaded.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [models]);

  const filtered = useMemo(() => {
    if (!models) return [];
    const q = query.trim().toLowerCase();
    return q ? models.filter((m) => m.id.toLowerCase().includes(q) || m.display_name?.toLowerCase().includes(q)) : models;
  }, [models, query]);

  const selected = models?.find((m) => m.id === model);
  const supportsReasoning = selected ? selected.reasoning : true;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col border border-border bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center">
          <h2 className="flex-1 font-medium lowercase">session settings</h2>
          <button aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto text-sm">
          <div className="text-xs text-muted-foreground">
            Provider <span className="text-foreground">{config.provider || "host default"}</span>
          </div>

          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Model</span>
            {loadModels ? (
              <div className="border border-input">
                <label className="flex items-center gap-2 border-b border-input px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search models"
                    className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <ul ref={listRef} role="listbox" aria-label="Models" className="max-h-56 overflow-y-auto">
                  {!models && !error && <li className="px-3 py-2 text-xs text-muted-foreground">Loading models...</li>}
                  {models && filtered.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No matching models.</li>}
                  {filtered.map((m) => (
                    <li key={m.id}>
                      <button
                        role="option"
                        aria-selected={m.id === model}
                        onClick={() => setModel(m.id)}
                        className={`flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left ${m.id === model ? "border-zot bg-accent text-foreground" : "border-transparent hover:bg-accent/60"}`}
                      >
                        <span className="min-w-0 flex-1 truncate">{m.id}</span>
                        {m.reasoning && <span className="shrink-0 text-[0.7rem] text-muted-foreground">reasoning</span>}
                        {m.context_window ? <span className="w-10 shrink-0 text-right text-[0.7rem] text-muted-foreground">{formatTokens(m.context_window)}</span> : null}
                        {m.id === model && <Check className="h-3.5 w-3.5 shrink-0 text-zot" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full border border-input bg-background px-3 py-2 outline-none focus:border-zot" />
            )}
            {models && !selected && model && <p className="mt-1 text-xs text-muted-foreground">Current model {model} is not in the host catalog.</p>}
          </div>

          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Reasoning</span>
            {supportsReasoning ? (
              <div className="flex flex-wrap gap-1.5">
                {reasoningLevels.map((r) => (
                  <button key={r} onClick={() => setReasoning(r)} className={`border px-2.5 py-1 text-xs ${reasoning === r ? "border-zot bg-zot text-black" : "border-border hover:bg-accent"}`}>
                    {r}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">This model does not support reasoning.</p>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Instructions</span>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="w-full resize-y border border-input bg-background px-3 py-2 outline-none focus:border-zot" />
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex gap-2 pt-4">
          <button
            disabled={busy || !model.trim()}
            onClick={() =>
              run(() =>
                onSave({
                  ...config,
                  model: model.trim(),
                  reasoning: !supportsReasoning || reasoning === "off" ? "" : reasoning,
                  instructions: instructions.trim() || undefined,
                }),
              )
            }
            className="flex-1 border border-zot px-4 py-2 text-zot hover:bg-zot hover:text-black disabled:opacity-50"
          >
            Save
          </button>
          <button disabled={busy} onClick={() => run(onCompact)} className="border border-border px-4 py-2 hover:bg-accent disabled:opacity-50">
            Compact now
          </button>
        </div>
      </div>
    </div>
  );
}
