import type { RankedPaper } from "./types";

/**
 * Client-side persistence (localStorage). All functions are SSR-safe and
 * fail quiet — private-mode quota errors should never break the UI.
 */

const SAVED_KEY = "articulate:saved";
const RECENT_KEY = "articulate:recent";
const MAX_RECENT = 6;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded / private mode — ignore */
  }
}

export function loadSaved(): RankedPaper[] {
  return read<RankedPaper[]>(SAVED_KEY, []);
}

export function persistSaved(papers: RankedPaper[]) {
  write(SAVED_KEY, papers);
}

export function loadRecent(): string[] {
  return read<string[]>(RECENT_KEY, []);
}

/** Prepend a query (deduped, case-insensitive), cap the list, persist, return it. */
export function pushRecent(query: string): string[] {
  const next = [
    query,
    ...loadRecent().filter((q) => q.toLowerCase() !== query.toLowerCase()),
  ].slice(0, MAX_RECENT);
  write(RECENT_KEY, next);
  return next;
}
