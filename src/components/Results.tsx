"use client";

import type { RankedPaper } from "@/lib/types";

/** Relevance score + Jev confidence, rendered as a quiet instrument. */
export function ScoreMeter({
  score,
  confidence,
}: {
  score: number | null;
  confidence: number | null;
}) {
  if (score === null) {
    return <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-300">n/a</span>;
  }
  const blocks = 10;
  const filled = Math.round((score / 100) * blocks);
  return (
    <div className="flex flex-col items-end gap-1" title={`Jev confidence: ${Math.round((confidence ?? 0) * 100)}%`}>
      <span className="font-mono text-xs tabular-nums text-neutral-950">
        {score.toFixed(1)}
      </span>
      <span className="flex gap-[2px]" aria-hidden="true">
        {Array.from({ length: blocks }, (_, i) => (
          <span
            key={i}
            className={`block h-[3px] w-[6px] ${i < filled ? "bg-neutral-950" : "bg-neutral-200"}`}
          />
        ))}
      </span>
    </div>
  );
}

export function ResultRow({
  paper,
  index,
  onSelect,
  saved,
  onToggleSave,
}: {
  paper: RankedPaper;
  index: number;
  onSelect: (paper: RankedPaper) => void;
  saved: boolean;
  onToggleSave: (paper: RankedPaper) => void;
}) {
  const year = new Date(paper.published).getFullYear();
  return (
    <li className="row-contain group grid grid-cols-[1fr_auto] border-b border-neutral-200 transition-colors hover:bg-neutral-50 has-focus-visible:bg-neutral-50">
      <button
        onClick={() => onSelect(paper)}
        className="grid h-[76px] w-full grid-cols-[3rem_1fr_auto] items-center gap-4 px-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950 sm:grid-cols-[4rem_1fr_8rem_auto] sm:pl-6 sm:pr-2"
      >
        <span className="font-mono text-xs tabular-nums text-neutral-400">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium tracking-tight text-neutral-950">
            {paper.title}
          </span>
          <span className="mt-1 block truncate text-xs text-neutral-500">
            {paper.authors.slice(0, 3).join(", ")}
            {paper.authors.length > 3 ? " et al." : ""} · {year}
          </span>
        </span>
        <span className="hidden sm:block">
          <ScoreMeter score={paper.score} confidence={paper.confidence} />
        </span>
        <span
          aria-hidden="true"
          className="font-mono text-sm text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-neutral-950"
        >
          →
        </span>
      </button>
      <button
        onClick={() => onToggleSave(paper)}
        aria-label={saved ? "Remove from reading list" : "Save to reading list"}
        aria-pressed={saved}
        title={saved ? "Remove from reading list" : "Save to reading list"}
        className="flex w-12 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950"
      >
        <span
          aria-hidden="true"
          className={`block size-[10px] border transition-colors ${
            saved
              ? "border-neutral-950 bg-neutral-950"
              : "border-neutral-300 group-hover:border-neutral-500"
          }`}
        />
      </button>
    </li>
  );
}

/** Exactly 20 fixed-height rows — matches the real list, zero layout shift. */
export function ResultSkeletons() {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <li
          key={i}
          className="row-contain grid h-[76px] grid-cols-[4rem_1fr_8rem_auto] items-center gap-4 border-b border-neutral-100 px-4 sm:px-6"
        >
          <span className="h-3 w-6 animate-pulse bg-neutral-100" />
          <span className="space-y-2">
            <span className="block h-3.5 w-3/4 animate-pulse bg-neutral-100" />
            <span className="block h-2.5 w-1/3 animate-pulse bg-neutral-100" />
          </span>
          <span className="hidden h-6 w-16 animate-pulse justify-self-end bg-neutral-100 sm:block" />
          <span />
        </li>
      ))}
    </ul>
  );
}
