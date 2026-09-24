"use client";

import { useEffect, useRef, useState } from "react";
import type { RankedPaper } from "@/lib/types";
import { Markdown } from "./Markdown";

type StreamState =
  | { status: "streaming"; text: string }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

export function SummaryPanel({
  paper,
  onClose,
}: {
  paper: RankedPaper;
  onClose: () => void;
}) {
  const [state, setState] = useState<StreamState>({ status: "streaming", text: "" });
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "streaming", text: "" });

    (async () => {
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            authors: paper.authors,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `Summary request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setState({ status: "streaming", text });
        }
        setState({ status: "done", text });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    })();

    return () => controller.abort();
  }, [paper]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const year = new Date(paper.published).getFullYear();

  return (
    <aside
      className="panel-in fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-neutral-200 bg-white sm:w-[540px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Summary of ${paper.title}`}
    >
      {/* Panel header */}
      <div className="border-b border-neutral-200 px-6 py-5 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400">
              arXiv:{paper.id} · {year}
            </p>
            <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-neutral-950">
              {paper.title}
            </h2>
            <p className="mt-1.5 truncate text-xs text-neutral-500">
              {paper.authors.join(", ")}
            </p>
          </div>
          <button
            onClick={onClose}
            autoFocus
            aria-label="Close summary"
            className="shrink-0 border border-neutral-200 px-2.5 py-1.5 font-mono text-xs text-neutral-500 transition-colors hover:border-neutral-950 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            ESC
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <a
            href={paper.absUrl}
            target="_blank"
            rel="noreferrer"
            className="border border-neutral-950 bg-neutral-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-neutral-950"
          >
            Abstract ↗
          </a>
          <a
            href={paper.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="border border-neutral-200 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-600 transition-colors hover:border-neutral-950 hover:text-neutral-950"
          >
            PDF ↗
          </a>
        </div>
      </div>

      {/* Panel body */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        {state.status === "error" ? (
          <div className="border border-neutral-200 p-4">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">
              Could not summarize
            </p>
            <p className="mt-2 text-sm text-neutral-600">{state.message}</p>
          </div>
        ) : (
          <div className={state.status === "streaming" ? "stream-caret" : ""}>
            {state.text ? (
              <Markdown text={state.text} />
            ) : (
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
                Reading paper…
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 px-6 py-3 sm:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400">
          {state.status === "streaming"
            ? "Generating articulate summary"
            : state.status === "done"
              ? "Summary complete · Read it aloud"
              : "Summary unavailable"}
        </p>
      </div>
    </aside>
  );
}
