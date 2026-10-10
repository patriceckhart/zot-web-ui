"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { highlight } from "@/lib/highlight";

// CodeBlock renders code with Shiki highlighting once the grammar is loaded
// and plain text before that or for unknown languages, so content never
// waits on highlighting.
export function HighlightedCode({ code, lang, className = "" }: { code: string; lang: string | null; className?: string }) {
  const [html, setHtml] = useState<{ key: string; value: string } | null>(null);
  const key = `${lang}\u0000${code}`;

  useEffect(() => {
    let cancelled = false;
    highlight(code, lang)
      .then((value) => {
        if (!cancelled && value) setHtml({ key, value });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, lang, key]);

  if (html && html.key === key) {
    return <div className={`shiki-wrap ${className}`} dangerouslySetInnerHTML={{ __html: html.value }} />;
  }
  return (
    <pre className={`shiki-wrap ${className}`}>
      <code>{code}</code>
    </pre>
  );
}

export function CodeBlock({ code, lang, label }: { code: string; lang: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="not-prose my-3 overflow-hidden border border-border bg-black/40">
      <div className="flex items-center justify-between border-b border-border/40 bg-white/[0.02] px-3 py-1">
        <span className="text-xs text-muted-foreground">{label ?? lang ?? "text"}</span>
        <button
          aria-label="Copy code"
          className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={() =>
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? <Check className="size-3.5 text-zot" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <HighlightedCode code={code} lang={lang} className="max-h-[32rem] overflow-auto px-4 py-3 text-[0.8rem] leading-relaxed" />
    </div>
  );
}
