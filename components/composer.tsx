"use client";

import { useRef, useState } from "react";
import { ArrowUp, FileText, Plus, Square, X } from "lucide-react";
import type { FileAttachment, ImageBlock } from "@/lib/protocol";

export type Draft = { text: string; images: ImageBlock[]; files: FileAttachment[] };

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
// The host accepts at most 16 attachments and 1 MiB of decoded bytes per
// submission; checking here gives an early, readable error.
const MAX_ATTACHMENTS = 16;
const MAX_BYTES = 1 << 20;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

type Props = {
  busy: boolean;
  disabled?: boolean;
  canAbort: boolean;
  attachments: boolean;
  placeholder?: string;
  onSubmit: (draft: Draft, steer: boolean) => Promise<boolean>;
  onAbort: () => void;
};

export function Composer({ busy, disabled, canAbort, attachments, placeholder, onSubmit, onAbort }: Props) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<(ImageBlock & { name: string; size: number })[]>([]);
  const [files, setFiles] = useState<(FileAttachment & { size: number })[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const addFiles = async (list: FileList | File[]) => {
    setError("");
    const nextImages = [...images];
    const nextFiles = [...files];
    for (const f of Array.from(list)) {
      if (nextImages.length + nextFiles.length >= MAX_ATTACHMENTS) {
        setError(`At most ${MAX_ATTACHMENTS} attachments`);
        break;
      }
      const data = toBase64(await f.arrayBuffer());
      if (IMAGE_TYPES.includes(f.type)) nextImages.push({ mime_type: f.type, data, name: f.name, size: f.size });
      else nextFiles.push({ name: f.name, data, size: f.size });
    }
    const total = [...nextImages, ...nextFiles].reduce((n, a) => n + a.size, 0);
    if (total > MAX_BYTES) {
      setError("Attachments exceed 1 MiB");
      return;
    }
    setImages(nextImages);
    setFiles(nextFiles);
  };

  const submit = async (steer: boolean) => {
    if (sending || disabled) return;
    if (!text.trim() && images.length === 0 && files.length === 0) return;
    setSending(true);
    setError("");
    const ok = await onSubmit(
      {
        text,
        images: images.map(({ mime_type, data }) => ({ mime_type, data })),
        files: files.map(({ name, data }) => ({ name, data })),
      },
      steer,
    );
    setSending(false);
    if (ok) {
      setText("");
      setImages([]);
      setFiles([]);
      area.current?.focus();
    }
  };

  const hasContent = text.trim() || images.length > 0 || files.length > 0;

  return (
    <div
      className="border-t border-border"
      onDragOver={(e) => attachments && e.preventDefault()}
      onDrop={(e) => {
        if (!attachments) return;
        e.preventDefault();
        void addFiles(e.dataTransfer.files);
      }}
    >
      {(images.length > 0 || files.length > 0) && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {images.map((img, i) => (
            <span key={`i${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={img.name} src={`data:${img.mime_type};base64,${img.data}`} className="h-14 w-14 rounded border border-border object-cover" />
              <button className="absolute -top-1.5 -right-1.5 rounded-full bg-muted p-0.5" aria-label="Remove" onClick={() => setImages(images.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {files.map((f, i) => (
            <span key={`f${i}`} className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs">
              <FileText className="h-3.5 w-3.5" /> {f.name}
              <button aria-label="Remove" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={area}
        rows={1}
        value={text}
        disabled={disabled}
        placeholder={placeholder ?? "Message zot..."}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
        }}
        onPaste={(e) => {
          if (!attachments) return;
          const imgs = Array.from(e.clipboardData.files).filter((f) => IMAGE_TYPES.includes(f.type));
          if (imgs.length) {
            e.preventDefault();
            void addFiles(imgs);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit(e.altKey);
          }
        }}
        className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[0.95rem] outline-none placeholder:text-muted-foreground"
      />
      {error && <p className="px-4 text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2 px-3 pb-3">
        {attachments && (
          <>
            <button className="rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label="Attach files" onClick={() => fileInput.current?.click()}>
              <Plus className="h-5 w-5" />
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
        <div className="flex-1" />
        {busy && hasContent && (
          <button className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground" title="Join the running turn at its next step (Alt+Enter)" onClick={() => void submit(true)}>
            Steer
          </button>
        )}
        {busy && canAbort && !hasContent ? (
          <button className="rounded-full border border-border p-1.5 hover:bg-accent" aria-label="Stop" onClick={onAbort}>
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            className="rounded-full p-1.5 text-muted-foreground enabled:hover:text-foreground disabled:opacity-40"
            aria-label={busy ? "Queue message" : "Send"}
            title={busy ? "Queue after the running turn" : "Send"}
            disabled={!hasContent || sending || disabled}
            onClick={() => void submit(false)}
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
