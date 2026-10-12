"use client";

import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { AgentConfig, HostModel } from "@/lib/protocol";
import { formatTokens } from "@/lib/conversation";
import { filterModels, matchesModel, modelPickerReducer, uniqueModels } from "@/lib/model-selection";

type Props = {
  config: AgentConfig;
  reasoningLevels: string[];
  // New hosts list models across usable providers. Older hosts list only the
  // current provider, or accept a typed model when model.list is unavailable.
  loadModels?: () => Promise<HostModel[]>;
  onClose: () => void;
  onSave: (config: AgentConfig) => Promise<void>;
  onCompact: () => Promise<void>;
};

export function ModelDialog({ config, reasoningLevels, loadModels, onClose, onSave, onCompact }: Props) {
  const [{ model, provider, open: pickerOpen }, dispatchPicker] = useReducer(modelPickerReducer, {
    model: config.model, provider: config.provider, open: true,
  });
  const pickerID = useId();
  const pickerButton = useRef<HTMLButtonElement>(null);
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
      .then((list) => !cancelled && setModels(uniqueModels(list, config.provider)))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, [loadModels, config.provider]);

  // Bring the current model into view once the catalog has loaded.
  useEffect(() => {
    if (pickerOpen) listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [models, pickerOpen]);

  const filtered = useMemo(() => {
    if (!models) return [];
    return filterModels(models, query);
  }, [models, query]);

  const selected = models?.find((m) => matchesModel(m, provider, model));
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
            Provider <span className="text-foreground">{provider || "host default"}</span>
          </div>

          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Model</span>
            {loadModels ? (
              <div className="border border-input">
                <button
                  ref={pickerButton}
                  aria-label="Choose model"
                  aria-expanded={pickerOpen}
                  aria-controls={pickerID}
                  aria-haspopup="listbox"
                  onClick={() => dispatchPicker({ type: "toggle" })}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/60"
                >
                  <span className="min-w-0 flex-1 truncate">{model || "Choose a model"}</span>
                  {pickerOpen ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                </button>
                <div hidden={!pickerOpen}>
                  <label className="flex items-center gap-2 border-y border-input px-3 py-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search models"
                      className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                  <ul id={pickerID} ref={listRef} role="listbox" aria-label="Models" className="max-h-56 overflow-y-auto">
                    {!models && !error && <li className="px-3 py-2 text-xs text-muted-foreground">Loading models...</li>}
                    {models && filtered.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No matching models.</li>}
                    {filtered.map((m) => (
                      <li key={JSON.stringify([m.provider, m.id])}>
                        <button
                          role="option"
                          aria-selected={matchesModel(m, provider, model)}
                          onClick={() => {
                            dispatchPicker({ type: "select", model: m });
                            setQuery("");
                            pickerButton.current?.focus();
                          }}
                          className={`flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left ${matchesModel(m, provider, model) ? "border-zot bg-accent text-foreground" : "border-transparent hover:bg-accent/60"}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{m.id}</span>
                            {m.provider && <span className="block truncate text-[0.7rem] text-muted-foreground">{m.provider}</span>}
                          </span>
                          {m.reasoning && <span className="shrink-0 text-[0.7rem] text-muted-foreground">reasoning</span>}
                          {m.context_window ? <span className="w-10 shrink-0 text-right text-[0.7rem] text-muted-foreground">{formatTokens(m.context_window)}</span> : null}
                          {matchesModel(m, provider, model) && <Check className="h-3.5 w-3.5 shrink-0 text-zot" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <input value={model} onChange={(e) => dispatchPicker({ type: "input", model: e.target.value })} className="w-full border border-input bg-background px-3 py-2 outline-none focus:border-zot" />
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
                  provider,
                  model: model.trim(),
                  reasoning: !supportsReasoning ? "off" : reasoning,
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
