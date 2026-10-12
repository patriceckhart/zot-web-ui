"use client";

import { useEffect, useRef, useState } from "react";

export type MenuItem = { label: string; icon?: React.ReactNode; run: () => void; disabled?: boolean } | "separator";

// ContextMenu is a small menu at a pointer position. It stays inside the
// viewport and closes on outside click, Escape, or after an item runs.
export function ContextMenu({ x, y, label, items, onDismiss }: { x: number; y: number; label: string; items: MenuItem[]; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // The position depends on the measured menu size.
    setPos({ x: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)), y: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) });
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [x, y]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onDismiss]);
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onDismiss}
        onContextMenu={(e) => {
          e.preventDefault();
          onDismiss();
        }}
      />
      <div ref={ref} role="menu" aria-label={label} className="fixed z-50 min-w-44 rounded-md border border-border bg-sidebar p-1 shadow-lg" style={{ left: pos.x, top: pos.y }}>
        {items.map((item, i) =>
          item === "separator" ? (
            <div key={i} className="my-1 h-px bg-border" />
          ) : (
            <button
              key={i}
              role="menuitem"
              disabled={item.disabled}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none disabled:opacity-40"
              onClick={() => {
                onDismiss();
                item.run();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}
