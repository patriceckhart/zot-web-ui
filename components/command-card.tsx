"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Command card styled like the install tabs on zot.sh: a tab header with a
// copy button and one-line commands prefixed with a cyan prompt.
export type CommandTab = { id: string; label: string; commands: string[] };

export function CommandCard({ tabs }: { tabs: CommandTab[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.commands.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable on insecure origins.
    }
  };

  return (
    <div className="w-full min-w-0 overflow-hidden border border-border bg-black/40">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-white/[0.02] px-2 py-1.5">
        <div role="tablist" className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={tab.id === active}
              onClick={() => {
                setActive(tab.id);
                setCopied(false);
              }}
              className={`flex-none border-b px-2.5 py-1 text-xs ${tab.id === active ? "border-zot text-zot" : "border-transparent text-muted-foreground hover:text-zot"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy command"
          className="flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        >
          {copied ? <Check className="size-3.5 text-zot" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed [scrollbar-width:none]">
        {current.commands.map((cmd, i) => (
          <code key={i} className="block whitespace-nowrap text-foreground/90">
            <span className="select-none text-zot" aria-hidden="true">
              ${" "}
            </span>
            {cmd}
          </code>
        ))}
      </pre>
    </div>
  );
}
