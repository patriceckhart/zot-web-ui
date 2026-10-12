"use client";

// ResizeHandle is a vertical drag handle on the edge of a side panel. It
// reports the new panel width; edge says which side of the panel it sits on.
export function ResizeHandle({
  edge,
  width,
  min,
  max,
  label,
  onResize,
}: {
  edge: "left" | "right";
  width: number;
  min: number;
  max: () => number;
  label: string;
  onResize: (width: number) => void;
}) {
  const clamp = (w: number) => Math.round(Math.min(Math.max(w, min), Math.max(min, max())));
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      tabIndex={0}
      className={`group absolute inset-y-0 z-20 hidden w-2 cursor-col-resize touch-none justify-center focus:outline-none md:flex ${edge === "left" ? "-left-1" : "-right-1"}`}
      onPointerDown={(e) => {
        e.preventDefault();
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startW = width;
        // Text selection and iframe-like children would otherwise steal the drag.
        document.body.style.userSelect = "none";
        const move = (ev: PointerEvent) => {
          const dx = ev.clientX - startX;
          onResize(clamp(edge === "left" ? startW - dx : startW + dx));
        };
        const up = () => {
          document.body.style.userSelect = "";
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerup", up);
          target.removeEventListener("pointercancel", up);
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", up);
        target.addEventListener("pointercancel", up);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        const grow = edge === "left" ? "ArrowLeft" : "ArrowRight";
        const shrink = edge === "left" ? "ArrowRight" : "ArrowLeft";
        if (e.key === grow) onResize(clamp(width + step));
        else if (e.key === shrink) onResize(clamp(width - step));
        else return;
        e.preventDefault();
      }}
    >
      <span className="h-full w-px bg-transparent group-hover:bg-zot group-focus-visible:bg-zot" />
    </div>
  );
}
