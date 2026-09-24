"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { RankedPaper, SearchResponse } from "@/lib/types";
import { loadRecent, loadSaved, persistSaved, pushRecent } from "@/lib/library";
import { featuredOfToday } from "@/lib/featured";
import {
  Crosshair,
  PixelGlyph,
  PixelGalaxy,
  PixelMark,
  PixelStrip,
} from "@/components/Pixel";
import { ResultRow, ResultSkeletons } from "@/components/Results";
import { SummaryPanel } from "@/components/SummaryPanel";

type Status = "idle" | "loading" | "done" | "error";
type View = "results" | "saved";

/** Curated entry points so the hero is never a blank box. */
const TOPICS = [
  { label: "Diffusion models", query: "diffusion models", variant: "A" as const },
  {
    label: "RLHF",
    query: "reinforcement learning from human feedback",
    variant: "B" as const,
  },
  { label: "Mixture of experts", query: "mixture of experts", variant: "C" as const },
  {
    label: "Interpretability",
    query: "mechanistic interpretability",
    variant: "A" as const,
  },
];

/** Landing-page pipeline explainer. */
const STEPS = [
  {
    n: "01",
    title: "Search arXiv",
    variant: "A" as const,
    body: "Your query hits the live arXiv API. Multi-word queries get exact title-phrase matching, so paper names just work.",
  },
  {
    n: "02",
    title: "Jev ranks",
    variant: "B" as const,
    body: "Every paper is scored for relevance by Jev, then sorted by relevance, not by arXiv's raw order.",
  },
  {
    n: "03",
    title: "Groq explains",
    variant: "C" as const,
    body: "One click streams the full text into a clear, articulate English summary. A model for your own writing.",
  },
];

/** The honest comparison: trade-offs included, per the YC playbook. */
const COMPARE = [
  {
    cap: "Understands full phrases, not just keywords",
    articulate: "Yes · title-phrase matching",
    arxiv: "Partial",
    scholar: "Yes",
  },
  {
    cap: "Ranks results by relevance to your query",
    articulate: "Yes · Jev scores every paper",
    arxiv: "No · submission order",
    scholar: "Citations, not relevance",
  },
  {
    cap: "Plain-English summary of any paper",
    articulate: "Yes · streams in seconds",
    arxiv: "No",
    scholar: "No",
  },
  {
    cap: "Reading list and daily paper pick",
    articulate: "Yes · built in",
    arxiv: "No",
    scholar: "Behind an account",
  },
];

/** Objection-handling FAQ. Doubles as FAQ structured data for SEO. */
const FAQ = [
  {
    q: "Is Articulate really free?",
    a: "Yes. No accounts, no tracking, no paywall. Search and summaries run on the free tiers of the arXiv, OpenRouter and Groq APIs.",
  },
  {
    q: "Where do the papers come from?",
    a: "Every result comes from arXiv, the open-access preprint archive with 2.6M+ papers across CS, physics, math and beyond. Links always go to the original paper.",
  },
  {
    q: "What is Jev?",
    a: "Jev is a decision model (typesafe/jev-1.13, via OpenRouter). It scores each candidate paper's relevance to your specific query with a single relevance score, so the best paper surfaces first, not the newest.",
  },
  {
    q: "Can a summary be wrong?",
    a: "Summaries are generated from the paper's own abstract, so they stay faithful to what the authors claim. For research-critical details, always open the PDF.",
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

/** Footer link columns; links without href render as plain text. */
const FOOTER_COLS: { title: string; links: { label: string; href?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Paper of the day", href: "#paper-of-the-day" },
      { label: "Questions", href: "#questions" },
    ],
  },
  {
    title: "Built with",
    links: [
      { label: "arXiv", href: "https://arxiv.org" },
      { label: "OpenRouter", href: "https://openrouter.ai" },
      { label: "Groq", href: "https://groq.com" },
    ],
  },
  {
    title: "Principles",
    links: [{ label: "Free forever" }, { label: "No accounts" }, { label: "No tracking" }],
  },
];

const PLACEHOLDERS = [
  "attention is all you need",
  "diffusion models for protein design",
  "reinforcement learning from human feedback",
  "retrieval augmented generation",
  "mixture of experts routing",
];

const STATS = [
  { value: "2.6M+", label: "papers on arXiv" },
  { value: "20", label: "ranked per search" },
  { value: "1 click", label: "to a clear summary" },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [view, setView] = useState<View>("results");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RankedPaper | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [saved, setSaved] = useState<RankedPaper[]>([]);

  // Hydrate client-side storage after mount (SSR-safe).
  useEffect(() => {
    setRecent(loadRecent());
    setSaved(loadSaved());
  }, []);

  // Rotate the hero search placeholder through example queries.
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length),
      2800,
    );
    return () => clearInterval(t);
  }, []);

  // Keyboard: "/" focuses the search box, Esc closes the summary panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>('input[aria-label="Search arXiv"]')
          ?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback(async (raw: string) => {
    const query = raw.trim();
    if (!query) return;
    setInput(query);
    setStatus("loading");
    setView("results");
    setError(null);
    setSelected(null);
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as SearchResponse | { error: string };
      if (!res.ok) throw new Error("error" in data ? data.error : "Search failed");
      setResult(data as SearchResponse);
      setStatus("done");
      setRecent(pushRecent(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setStatus("error");
    }
  }, []);

  const toggleSaved = useCallback((paper: RankedPaper) => {
    setSaved((prev) => {
      const exists = prev.some((p) => p.id === paper.id);
      const next = exists
        ? prev.filter((p) => p.id !== paper.id)
        : [paper, ...prev];
      persistSaved(next);
      return next;
    });
  }, []);

  const goHome = () => {
    setStatus("idle");
    setView("results");
    setSelected(null);
    setError(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void search(input);
  };

  const savedIds = new Set(saved.map((p) => p.id));
  const featured = featuredOfToday();

  return (
    <div
      className={`min-h-screen bg-white transition-[padding] duration-300 ease-out ${
        selected ? "sm:pr-[540px]" : ""
      }`}
    >
      {/* Full-height column guides: the grid everything snaps to. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 mx-auto hidden max-w-7xl lg:block"
      >
        <div className="absolute inset-y-0 left-1/4 w-px bg-neutral-100" />
        <div className="absolute inset-y-0 left-2/4 w-px bg-neutral-100" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-neutral-100" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between border-x border-neutral-200 px-4 sm:px-6">
          <Link
            href="/"
            onClick={goHome}
            className="flex items-center gap-2.5"
            aria-label="Articulate home"
          >
            <PixelMark className="size-4 text-neutral-950" />
            <span className="font-mono text-sm font-medium uppercase tracking-[0.25em] text-neutral-950">
              Articulate
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400 md:block">
              arXiv · Jev · Clear English
            </p>
            <button
              onClick={() => setView((v) => (v === "saved" ? "results" : "saved"))}
              aria-pressed={view === "saved"}
              className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                view === "saved"
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950"
              }`}
            >
              Saved · {saved.length}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl border-x border-neutral-200 px-4 sm:px-6">
        {view === "saved" ? (
          /* ------------------------------------------------ Reading list */
          <section className="py-8">
            <CompactSearch
              input={input}
              loading={status === "loading"}
              onInput={setInput}
              onSubmit={onSubmit}
            />
            <StatusLine
              text={
                saved.length === 1 ? "1 saved paper" : `${saved.length} saved papers`
              }
            />
            {saved.length === 0 ? (
              <div className="border border-neutral-200 p-10 text-center">
                <PixelStrip className="mb-6 justify-center" count={12} />
                <p className="text-sm text-neutral-500">
                  Nothing saved yet. Hit the square on any result to pin it here.
                </p>
              </div>
            ) : (
              <ul className="border-t border-neutral-200" onKeyDown={onResultListKeyDown}>
                {saved.map((paper, i) => (
                  <ResultRow
                    key={paper.id}
                    paper={paper}
                    index={i}
                    onSelect={setSelected}
                    saved
                    onToggleSave={toggleSaved}
                  />
                ))}
              </ul>
            )}
          </section>
        ) : status === "idle" ? (
          <>
          {/* ---------------------------------------------------- Hero */}
          <section className="relative overflow-hidden py-14 lg:flex lg:min-h-[calc(92vh-3.5rem)] lg:items-center">
            <div
              aria-hidden="true"
              className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_72%)]"
            />
            <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-300" />
            <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-300" />

            <div className="grid w-full items-center gap-14 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <PixelGalaxy
              size={190}
              stars={340}
              className="mb-10 text-neutral-950 lg:hidden"
            />
            <PixelStrip className="mb-10 hidden lg:block" count={24} />
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-950 sm:text-6xl">
              Read research.
              <br />
              Speak precisely.
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-neutral-500">
              Search arXiv. Jev ranks the top 20 papers. One click streams a
              clear, articulate English summary; a model for your own writing.
            </p>

            <form onSubmit={onSubmit} className="mt-10 w-full max-w-xl">
              <div className="flex border border-neutral-950 transition-shadow focus-within:shadow-[4px_4px_0_0_#e5e5e5]">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={PLACEHOLDERS[placeholderIdx]}
                  aria-label="Search arXiv"
                  enterKeyHint="search"
                  maxLength={200}
                  className="h-13 min-w-0 flex-1 bg-white px-4 font-mono text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-13 shrink-0 border-l border-neutral-950 bg-neutral-950 px-6 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-neutral-950 active:scale-[0.98]"
                >
                  Search
                </button>
              </div>
            </form>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-300">
              press / to search · esc to close
            </p>

            {recent.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-300">
                  Recent
                </span>
                {recent.map((q) => (
                  <button
                    key={q}
                    onClick={() => void search(q)}
                    className="border border-neutral-200 px-3 py-1.5 font-mono text-[11px] text-neutral-500 transition-colors hover:border-neutral-950 hover:text-neutral-950 active:scale-[0.98]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-10 grid w-full max-w-xl grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-4">
              {TOPICS.map((topic) => (
                <button
                  key={topic.label}
                  onClick={() => void search(topic.query)}
                  className="group flex flex-col items-start gap-3 bg-white p-3 text-left transition-colors hover:bg-neutral-50 active:scale-[0.98]"
                >
                  <PixelGlyph
                    seed={topic.label}
                    size={20}
                    density={0.5}
                    variant={topic.variant}
                    className="text-neutral-950"
                  />
                  <span className="w-full truncate font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500 transition-colors group-hover:text-neutral-950">
                    {topic.label}
                  </span>
                </button>
              ))}
            </div>

            <PixelStrip className="mt-14" count={24} />
              </div>

              {/* Fig 00: the galaxy. One big moving thing. */}
              <div className="hidden lg:flex lg:items-center lg:justify-center lg:self-stretch">
                <div className="relative -mt-24 -ml-12">
                  <PixelGalaxy className="block text-neutral-950" />
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- Stats */}
          <section className="relative border-t border-neutral-200 py-16">
            <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-300" />
            <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-300" />
            <div className="grid grid-cols-3 divide-x divide-neutral-200 border border-neutral-200">
              {STATS.map((stat) => (
                <div key={stat.label} className="px-2 py-10 text-center">
                  <p className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ------------------------------------------ How it works */}
          <section id="how-it-works" className="relative scroll-mt-14 border-t border-neutral-200 py-16 sm:py-20">
            <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-300" />
            <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-300" />
            <SectionLabel index="01" text="How it works" />
            <div className="mt-8 grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="bg-white p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                      Fig {step.n}
                    </span>
                    <PixelGlyph
                      seed={step.title}
                      size={18}
                      density={0.55}
                      variant={step.variant}
                      className="text-neutral-950"
                    />
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight text-neutral-950">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ------------------------------------------ Paper of the day */}
          <section id="paper-of-the-day" className="relative scroll-mt-14 border-t border-neutral-200 py-16 sm:py-20">
            <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-300" />
            <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-300" />
            <SectionLabel index="02" text="Paper of the day" />
            <div className="relative mt-8 border border-neutral-950 p-6 sm:p-10">
              <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-950" />
              <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-950" />
              <Crosshair className="absolute -bottom-2 -left-2 size-4 text-neutral-950" />
              <Crosshair className="absolute -bottom-2 -right-2 size-4 text-neutral-950" />
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                arXiv:{featured.id} · {new Date(featured.published).getFullYear()}
              </p>
              <h3 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-3xl">
                {featured.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                {featured.authors.slice(0, 4).join(", ")}
                {featured.authors.length > 4 ? " et al." : ""}
              </p>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-600">
                {featured.pitch}
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelected(featured)}
                  className="group border border-neutral-950 bg-neutral-950 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-neutral-950 active:scale-[0.98]"
                >
                  Summarize{" "}
                  <span className="inline-block transition-transform duration-150 group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
                <button
                  onClick={() => void search(featured.title)}
                  className="border border-neutral-200 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-neutral-500 transition-colors hover:border-neutral-950 hover:text-neutral-950 active:scale-[0.98]"
                >
                  Find similar
                </button>
              </div>
            </div>
          </section>

          {/* ------------------------------------------ Why switch */}
          <section className="relative border-t border-neutral-200 py-16 sm:py-20">
            <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-300" />
            <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-300" />
            <SectionLabel index="03" text="Why switch" />
            <h3 className="mt-4 max-w-lg text-2xl font-medium tracking-tight text-neutral-950 sm:text-3xl">
              The honest comparison.
            </h3>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse border border-neutral-200 text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="bg-neutral-50 p-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                      Capability
                    </th>
                    <th className="border-l border-neutral-200 bg-neutral-950 p-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white">
                      Articulate
                    </th>
                    <th className="border-l border-neutral-200 bg-neutral-50 p-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                      arXiv search
                    </th>
                    <th className="border-l border-neutral-200 bg-neutral-50 p-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                      Google Scholar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.cap} className="border-b border-neutral-200 last:border-0">
                      <td className="p-3 text-neutral-700">{row.cap}</td>
                      <td className="border-l border-neutral-200 bg-neutral-50/60 p-3 font-medium text-neutral-950">
                        {row.articulate}
                      </td>
                      <td className="border-l border-neutral-200 p-3 text-neutral-500">
                        {row.arxiv}
                      </td>
                      <td className="border-l border-neutral-200 p-3 text-neutral-500">
                        {row.scholar}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ---------------------------------------------------- FAQ */}
          <section id="questions" className="relative scroll-mt-14 border-t border-neutral-200 py-16 sm:py-20">
            <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-300" />
            <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-300" />
            <SectionLabel index="04" text="Questions" />
            <div className="mt-8 border-t border-neutral-200">
              {FAQ.map((item) => (
                <details key={item.q} className="group border-b border-neutral-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 pr-1 text-sm font-medium text-neutral-950 transition-colors hover:text-neutral-500 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="font-mono text-base leading-none text-neutral-400 transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-5 text-sm leading-relaxed text-neutral-500">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
            />
          </section>

          {/* --------------------------------------------- Final CTA */}
          <section className="relative border-t border-neutral-200 py-16 text-center sm:py-24">
            <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-300" />
            <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-300" />
            <div className="flex justify-center">
              <SectionLabel index="05" text="Start" />
            </div>
            <h3 className="mx-auto mt-4 max-w-xl text-3xl font-medium leading-tight tracking-tight text-neutral-950 sm:text-4xl">
              Built for researchers. Free forever.
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-500">
              2.6 million papers. Twenty ranked. One clear summary away.
            </p>
            <form onSubmit={onSubmit} className="mx-auto mt-8 w-full max-w-md">
              <div className="flex border border-neutral-950 transition-shadow focus-within:shadow-[4px_4px_0_0_#e5e5e5]">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="try a topic, a method, a paper title"
                  aria-label="Search arXiv"
                  enterKeyHint="search"
                  maxLength={200}
                  className="h-12 min-w-0 flex-1 bg-white px-4 font-mono text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-12 shrink-0 border-l border-neutral-950 bg-neutral-950 px-5 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-neutral-950 active:scale-[0.98]"
                >
                  Search
                </button>
              </div>
            </form>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-300">
              press / to search from anywhere
            </p>
          </section>
          </>
        ) : (
          /* -------------------------------------------- Results view */
          <section className="py-8">
            <CompactSearch
              input={input}
              loading={status === "loading"}
              onInput={setInput}
              onSubmit={onSubmit}
            />

            {status === "loading" && (
              <>
                <StatusLine text="Querying arXiv · ranking with Jev" />
                <ResultSkeletons />
              </>
            )}

            {status === "error" && (
              <div className="border border-neutral-200 p-6" role="alert">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
                  Search failed
                </p>
                <p className="mt-2 text-sm text-neutral-600">{error}</p>
                <button
                  onClick={() => void search(input)}
                  className="mt-4 border border-neutral-950 px-4 py-2 font-mono text-xs uppercase tracking-widest text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {status === "done" && result && (
              <>
                <StatusLine
                  text={
                    result.papers.length === 0
                      ? `0 papers for “${result.query}”`
                      : result.ranked
                        ? `${result.papers.length} papers · ranked by Jev`
                        : `${result.papers.length} papers · arXiv relevance order (Jev offline)`
                  }
                />
                {result.papers.length === 0 ? (
                  <div className="border border-neutral-200 p-10 text-center">
                    <PixelStrip className="mb-6 justify-center" count={12} />
                    <p className="text-sm text-neutral-500">
                      No papers found for “{result.query}”. Try broader keywords.
                    </p>
                  </div>
                ) : (
                  <ul className="border-t border-neutral-200" onKeyDown={onResultListKeyDown}>
                    {result.papers.map((paper, i) => (
                      <ResultRow
                        key={paper.id}
                        paper={paper}
                        index={i}
                        onSelect={setSelected}
                        saved={savedIds.has(paper.id)}
                        onToggleSave={toggleSaved}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-200">
        <div className="relative mx-auto max-w-7xl border-x border-neutral-200 px-4 sm:px-6">
          <Crosshair className="absolute -left-2 -top-2 size-4 text-neutral-300" />
          <Crosshair className="absolute -right-2 -top-2 size-4 text-neutral-300" />
          <div className="grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2.5">
                <PixelMark className="size-4 text-neutral-950" />
                <span className="font-mono text-xs font-medium uppercase tracking-[0.25em] text-neutral-950">
                  Articulate
                </span>
              </div>
              <p className="mt-3 max-w-[26ch] font-mono text-[11px] leading-relaxed text-neutral-400">
                Read research. Speak precisely.
              </p>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                  {col.title}
                </p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.href ? (
                        <a
                          href={l.href}
                          target={l.href.startsWith("http") ? "_blank" : undefined}
                          rel="noreferrer"
                          className="font-mono text-[11px] text-neutral-500 transition-colors hover:text-neutral-950"
                        >
                          {l.label}
                        </a>
                      ) : (
                        <span className="font-mono text-[11px] text-neutral-400">
                          {l.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex h-12 items-center justify-between border-t border-neutral-200">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400">
              Data · arXiv · Ranking · Jev by TypeSafe
            </p>
            <PixelStrip count={8} />
          </div>
        </div>
      </footer>

      {/* Summary panel */}
      {selected && (
        <SummaryPanel paper={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function StatusLine({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-center gap-3" role="status" aria-live="polite">
      <span className="block size-[6px] bg-neutral-950" aria-hidden="true" />
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
        {text}
      </p>
    </div>
  );
}

/** ↑/↓ moves focus through result rows; Enter is native on the focused row. */
function onResultListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const rows = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>("li > button:first-child"),
  );
  if (rows.length === 0) return;
  const idx = rows.findIndex((r) => r === document.activeElement);
  const next =
    e.key === "ArrowDown"
      ? (idx + 1) % rows.length
      : (idx - 1 + rows.length) % rows.length;
  e.preventDefault();
  rows[next]?.focus();
}

/** Landing-page section heading, indexed like a numbered document. */
function SectionLabel({ index, text }: { index?: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="block size-[6px] bg-neutral-950" aria-hidden="true" />
      {index && (
        <span className="font-mono text-[11px] tracking-[0.25em] text-neutral-300">
          §{index}
        </span>
      )}
      <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">
        {text}
      </h2>
    </div>
  );
}

/** Compact search bar shared by the results and reading-list views. */
function CompactSearch({
  input,
  loading,
  onInput,
  onSubmit,
}: {
  input: string;
  loading: boolean;
  onInput: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mb-6">
      <div className="flex border border-neutral-200 focus-within:border-neutral-950">
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          aria-label="Search arXiv"
          enterKeyHint="search"
          maxLength={200}
          className="h-11 min-w-0 flex-1 bg-white px-4 font-mono text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-11 shrink-0 border-l border-neutral-200 px-5 font-mono text-xs uppercase tracking-[0.2em] text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white active:scale-[0.98] disabled:cursor-wait disabled:opacity-40"
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
    </form>
  );
}

