"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronRight, Copy, Loader2, Sparkles, SquareTerminal, X } from "lucide-react";
import type { Components } from "react-markdown";
import type { Item, ToolCallItem } from "@/lib/conversation";
import { argsSummary } from "@/lib/conversation";
import { langFromPath, resolveLang } from "@/lib/highlight";
import { CodeBlock, HighlightedCode } from "./code-block";

// Fenced code becomes a highlighted CodeBlock. Inline code stays inline.
const markdownComponents: Components = {
  a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children ?? "");
    const match = /language-([\w+#.-]+)/.exec(className ?? "");
    if (!match && !text.includes("\n")) return <code className={className}>{children}</code>;
    const label = match?.[1];
    return <CodeBlock code={text.replace(/\n$/, "")} lang={resolveLang(label)} label={label} />;
  },
};

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-zot">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

// ToolBody renders the most useful view of a tool call: file contents for
// read and write, old and new text for edit, shell output for bash, and the
// raw arguments plus output for anything else.
function ToolBody({ item }: { item: ToolCallItem }) {
  const args = (item.args && typeof item.args === "object" ? item.args : {}) as Args;
  const output = item.result?.text ?? item.progress ?? "";
  const failed = !!item.result?.isError;
  const path = str(args.path) ?? str(args.file_path);
  const lang = langFromPath(path);
  const pane = "max-h-96 overflow-auto px-3 py-2";

  if (failed || (!item.result && !item.progress && item.name !== "write" && item.name !== "edit")) {
    return (
      <>
        <ArgsPane args={item.args} />
        <pre className={`${pane} wrap whitespace-pre-wrap break-words ${failed ? "text-destructive" : ""}`}>{output || (item.running ? "running..." : "(no output)")}</pre>
      </>
    );
  }
  switch (item.name) {
    case "read":
      return <HighlightedCode code={output.replace(/\n$/, "")} lang={lang} className={`${pane} numbered`} />;
    case "write":
      // The write result echoes the content, so the arguments are enough.
      return <HighlightedCode code={(str(args.content) ?? output).replace(/\n$/, "")} lang={lang} className={`${pane} numbered`} />;
    case "edit": {
      // The edit result is a unified diff. Older hosts may return a short
      // message instead; then the requested replacements are shown.
      if (/^(@@|---|\+\+\+|[-+ ])/m.test(output) && output.includes("\n")) {
        return <HighlightedCode code={output.replace(/\n$/, "")} lang="diff" className={pane} />;
      }
      const edits = Array.isArray(args.edits) ? (args.edits as Args[]) : [args];
      const diff = edits
        .map((e) => {
          const oldText = str(e.oldText) ?? str(e.old_text) ?? "";
          const newText = str(e.newText) ?? str(e.new_text) ?? "";
          return [...oldText.split("\n").map((l) => "-" + l), ...newText.split("\n").map((l) => "+" + l)].join("\n");
        })
        .join("\n");
      return (
        <>
          <HighlightedCode code={diff} lang="diff" className={pane} />
          {output && <div className="border-t border-border px-3 py-1.5 text-muted-foreground">{output}</div>}
        </>
      );
    }
    case "bash":
    case "powershell":
      return (
        <>
          {str(args.command) && <HighlightedCode code={str(args.command)!} lang={item.name === "bash" ? "bash" : "powershell"} className="wrap max-h-48 overflow-auto border-b border-border px-3 py-2" />}
          <pre className={`${pane} whitespace-pre-wrap break-words`}>{output || "(no output)"}</pre>
        </>
      );
    default:
      return (
        <>
          <ArgsPane args={item.args} />
          <pre className={`${pane} whitespace-pre-wrap break-words`}>{output || (item.running ? "running..." : "(no output)")}</pre>
        </>
      );
  }
}

function ArgsPane({ args }: { args: unknown }) {
  if (args === undefined) return null;
  return <HighlightedCode code={JSON.stringify(args, null, 2)} lang="json" className="wrap max-h-48 overflow-auto border-b border-border px-3 py-2" />;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="mt-2 text-muted-foreground hover:text-foreground"
      aria-label="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ToolCall({ item }: { item: ToolCallItem }) {
  const [open, setOpen] = useState(false);
  const summary = argsSummary(item.name, item.args);
  return (
    <div className="font-mono text-[0.8rem]">
      <button className="group flex w-full items-center gap-2 py-1 text-left text-muted-foreground hover:text-foreground" onClick={() => setOpen((o) => !o)}>
        <SquareTerminal className="h-4 w-4 shrink-0" />
        <span className="shrink-0 text-foreground/80">{item.name}</span>
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        {item.running ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
        ) : item.result ? (
          item.result.isError ? <X className="h-3.5 w-3.5 shrink-0 text-destructive" /> : <Check className="h-3.5 w-3.5 shrink-0" />
        ) : null}
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="mb-2 ml-6 overflow-hidden border border-border bg-black/40">
          <ToolBody item={item} />
          {item.result?.images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} alt="tool output" className="max-h-96 p-2" src={`data:${img.mime_type};base64,${img.data}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Thought({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-sm text-muted-foreground">
      <button className="flex items-center gap-2 hover:text-foreground" onClick={() => setOpen((o) => !o)}>
        <Sparkles className="h-3.5 w-3.5" /> Thought <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="mt-2 border-l-2 border-border pl-4 whitespace-pre-wrap">{text}</div>}
    </div>
  );
}

export function Transcript({ items }: { items: Item[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        switch (item.kind) {
          case "user":
            return (
              <div key={item.key} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-card px-4 py-2.5">
                  {item.steer && <div className="mb-1 text-[0.7rem] font-medium tracking-wide text-primary uppercase">Steer</div>}
                  {item.images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {item.images.map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} alt="attachment" className="h-24 rounded border border-border object-cover" src={`data:${img.mime_type};base64,${img.data}`} />
                      ))}
                    </div>
                  )}
                  <div className="text-[0.95rem] whitespace-pre-wrap break-words">{item.text}</div>
                </div>
              </div>
            );
          case "assistant":
            return (
              <div key={item.key}>
                <Markdown text={item.text} />
                <CopyButton text={item.text} />
              </div>
            );
          case "streaming":
            return (
              <div key={item.key}>
                <Markdown text={item.text} />
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
              </div>
            );
          case "thought":
            return <Thought key={item.key} text={item.text} />;
          case "tool":
            return <ToolCall key={item.key} item={item} />;
          case "notice":
            return (
              <p key={item.key} className={`text-sm ${item.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {item.text}
              </p>
            );
        }
      })}
    </div>
  );
}
