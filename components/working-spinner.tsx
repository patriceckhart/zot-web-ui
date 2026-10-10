"use client";

import { useEffect, useState } from "react";

// Same frames and cadence as the zot TUI spinner (packages/tui/theme.go,
// 120 ms tick in interactive mode).
const FRAMES = ["⠋", "⠙", "⠚", "⠞", "⠖", "⠦", "⠴", "⠲", "⠳", "⠓"];
const INTERVAL_MS = 120;

export function WorkingSpinner({ label = "working" }: { label?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      <span className="inline-block w-[1.2em] text-center text-xl leading-none text-zot" aria-hidden="true">
        {FRAMES[frame]}
      </span>
      <span>{label}</span>
    </div>
  );
}
