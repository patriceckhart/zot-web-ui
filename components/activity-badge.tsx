"use client";

import type { Activity } from "@/lib/use-activity";
import { SpinnerGlyph } from "./working-spinner";

// ActivityBadge is the compact session state shown in the sidebar.
export function ActivityBadge({ activity }: { activity?: Activity }) {
  switch (activity) {
    case "working":
      return (
        <span className="flex items-center gap-1 text-zot" title="working">
          <SpinnerGlyph />
          <span>working</span>
        </span>
      );
    case "approval":
      return (
        <span className="text-zot" title="awaiting approval">
          approval
        </span>
      );
    case "queued":
      return <span title="queued">queued</span>;
    default:
      return null;
  }
}
