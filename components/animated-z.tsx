"use client"

import * as React from "react"

/**
 * AnimatedZ — the pixel "z" mark, reimplemented as inline SVG with a
 * per-tile opacity animation driven by requestAnimationFrame.
 *
 * The static SVG in public/zot.svg has three opacity tiers:
 *   - 1.0  fully-lit tiles (the body of the Z)
 *   - 0.5  half-lit accent tiles
 *   - 0.2/0.3  dim "background-noise" tiles inside the letter's bbox
 *
 * Visual concept:
 *   1. Every tile gently shimmers around its base opacity (small-
 *      amplitude sine wave at a slow rate, per-tile phase offset so
 *      they don't all peak at once). This keeps the mark feeling
 *      alive even at rest.
 *   2. A diagonal "sweep" travels top-left -> bottom-right across
 *      the grid every few seconds, briefly boosting tiles to full
 *      brightness as it passes. The sweep distance is computed from
 *      each tile's (col + row) position so it follows the natural
 *      reading direction of the Z letterform.
 *
 * Reduced motion: `prefers-reduced-motion: reduce` falls back to the
 * static base opacities so users who opt out of animation just see
 * the original mark.
 */

// Tile descriptors copied verbatim from public/zot.svg so the
// animated and static versions stay pixel-identical.
type Tile = { x: number; y: number; o: number }

const TILES: Tile[] = [
  { x: 0, y: 0, o: 1 },
  { x: 0, y: 275, o: 1 },
  { x: 0, y: 55, o: 1 },
  { x: 0, y: 330, o: 1 },
  { x: 55, y: 0, o: 0.2 },
  { x: 55, y: 275, o: 1 },
  { x: 55, y: 55, o: 1 },
  { x: 55, y: 330, o: 1 },
  { x: 55, y: 220, o: 1 },
  { x: 110, y: 0, o: 1 },
  { x: 110, y: 275, o: 1 },
  { x: 110, y: 55, o: 1 },
  { x: 110, y: 330, o: 0.2 },
  { x: 110, y: 220, o: 0.2 },
  { x: 110, y: 165, o: 1 },
  { x: 165, y: 0, o: 1 },
  { x: 165, y: 275, o: 0.5 },
  { x: 165, y: 55, o: 0.5 },
  { x: 165, y: 330, o: 1 },
  { x: 165, y: 220, o: 1 },
  { x: 165, y: 165, o: 1 },
  { x: 165, y: 110, o: 1 },
  { x: 220, y: 0, o: 1 },
  { x: 220, y: 275, o: 1 },
  { x: 220, y: 55, o: 1 },
  { x: 220, y: 330, o: 1 },
  { x: 220, y: 165, o: 0.5 },
  { x: 220, y: 110, o: 1 },
  { x: 275, y: 0, o: 1 },
  { x: 275, y: 275, o: 1 },
  { x: 275, y: 55, o: 0.2 },
  { x: 275, y: 330, o: 0.3 },
  { x: 275, y: 110, o: 1 },
  { x: 330, y: 0, o: 1 },
  { x: 330, y: 275, o: 1 },
  { x: 330, y: 55, o: 1 },
  { x: 330, y: 330, o: 1 },
]

// Tunables. Bigger AMP = more shimmer; smaller PERIOD = faster.
const SHIMMER_AMP = 0.18 // peak deviation from base opacity
const SHIMMER_PERIOD_MS = 2600 // one full sine cycle
const SWEEP_PERIOD_MS = 3400 // time for one sweep to traverse the grid
const SWEEP_WIDTH = 1.4 // diagonal "band" half-width, in grid steps
const SWEEP_GAIN = 0.55 // how much extra opacity the sweep adds at its peak

// Each tile sits on a 7-column / 7-row implicit grid (0..6, 0..6).
// Precompute its column, row, diagonal index, and a deterministic
// per-tile phase offset so the sine waves don't peak in lockstep.
type PreparedTile = Tile & {
  col: number
  row: number
  diag: number // col + row, 0..12
  phase: number // 0..2π, stable across renders
}

const PREPARED: PreparedTile[] = TILES.map((t) => {
  const col = t.x / 55
  const row = t.y / 55
  // Hash-ish: pick something deterministic that varies cell-by-cell
  // so neighbors shimmer out of phase.
  const phase =
    (((col * 7 + row * 11 + col * row * 3) % 7) / 7) * Math.PI * 2
  return { ...t, col, row, diag: col + row, phase }
})

const DIAG_MAX = 12 // 6 + 6, the furthest tile in the grid

export function AnimatedZ({
  width = 70,
  height = 70,
  className,
}: {
  width?: number
  height?: number
  className?: string
}) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  // We update the DOM imperatively rather than through React state.
  // setting 37 attributes via JSX every frame would thrash the
  // reconciler and slow Safari to a crawl; touching `fillOpacity`
  // on the existing nodes is essentially free.
  const rectsRef = React.useRef<(SVGRectElement | null)[]>([])
  const reducedMotion = useReducedMotion()

  React.useEffect(() => {
    if (reducedMotion) return
    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = now - start
      // Sweep position: maps time -> a virtual diagonal index that
      // loops past the end of the grid plus a margin, so the tail of
      // one sweep clears before the head of the next appears.
      const sweepHead =
        ((t % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS) * (DIAG_MAX + SWEEP_WIDTH * 4) -
        SWEEP_WIDTH * 2

      for (let i = 0; i < PREPARED.length; i++) {
        const tile = PREPARED[i]
        const node = rectsRef.current[i]
        if (!node) continue

        // 1) Shimmer: smooth oscillation around the base opacity.
        const shimmer =
          SHIMMER_AMP *
          Math.sin((t / SHIMMER_PERIOD_MS) * Math.PI * 2 + tile.phase)

        // 2) Sweep: a Gaussian-ish bump centered on the moving
        //    diagonal. Distance is measured in grid units, so the
        //    visual thickness is consistent regardless of viewport.
        const d = tile.diag - sweepHead
        const sweep = SWEEP_GAIN * Math.exp(-(d * d) / (2 * SWEEP_WIDTH * SWEEP_WIDTH))

        const next = clamp01(tile.o + shimmer + sweep)
        node.setAttribute("fill-opacity", next.toFixed(3))
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox="0 0 375 375"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      // Preserve the pixel-y look of the original — no smoothing on
      // the SVG itself either, just in case it's rendered scaled.
      style={{ imageRendering: "pixelated" }}
      aria-label="zot"
      role="img"
      className={className}
    >
      {PREPARED.map((tile, i) => (
        <rect
          key={i}
          ref={(el) => {
            rectsRef.current[i] = el
          }}
          x={tile.x}
          y={tile.y}
          width={45}
          height={45}
          fill="#6ADAFF"
          fillOpacity={tile.o}
        />
      ))}
    </svg>
  )
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

// Mirror of `window.matchMedia('(prefers-reduced-motion: reduce)')`
// kept reactive so the animation halts immediately if the user flips
// the OS-level setting while the tab is open.
function useReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduce(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return reduce
}
