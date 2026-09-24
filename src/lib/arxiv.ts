import { XMLParser } from "fast-xml-parser";
import type { Paper } from "./types";

const ARXIV_API = "https://export.arxiv.org/api/query";
const MAX_RESULTS = 20;
/** arXiv asks for no more than 1 request every 3 seconds. */
const MIN_INTERVAL_MS = 3000;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * arXiv's index ignores common English stopwords, so AND-ing them into
 * search_query collapses the result set to zero. Filter them out.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how",
  "in", "is", "it", "its", "of", "on", "or", "that", "the", "their",
  "this", "to", "via", "was", "we", "with", "you", "your", "all",
]);

// ---------------------------------------------------------------------------
// Rate limiter: serialize arXiv requests, at most one every 3 seconds.
// ---------------------------------------------------------------------------

let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fetch(url, {
      headers: { "User-Agent": "articulate/1.0 (https://arxiv.org/help/api)" },
      signal: AbortSignal.timeout(15000),
    });
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ---------------------------------------------------------------------------
// Tiny in-memory cache (per serverless instance).
// ---------------------------------------------------------------------------

const cache = new Map<string, { at: number; papers: Paper[] }>();

// ---------------------------------------------------------------------------
// Atom XML parsing. Namespaces are stripped; entries live under feed.entry.
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  textNodeName: "#text",
});

interface XmlLink {
  "@_rel"?: string;
  "@_href": string;
  "@_title"?: string;
  "@_type"?: string;
}

interface XmlEntry {
  id: string;
  title: string;
  summary: string;
  published?: string;
  author?: { name: string } | { name: string }[];
  link?: XmlLink | XmlLink[];
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseEntry(entry: XmlEntry): Paper | null {
  // arXiv signals API errors with a pseudo-entry whose summary starts with "Error".
  if (!entry.published || /^error/i.test(normalize(entry.summary ?? ""))) {
    return null;
  }
  const absUrl: string = entry.id;
  const id = absUrl.split("/abs/")[1]?.replace(/v\d+$/, "") ?? absUrl;
  const links = asArray(entry.link);
  const pdfLink =
    links.find((l) => l["@_title"] === "pdf") ??
    links.find((l) => l["@_type"] === "application/pdf");

  return {
    id,
    title: normalize(entry.title),
    authors: asArray(entry.author).map((a) => a.name),
    abstract: normalize(entry.summary),
    published: entry.published,
    absUrl,
    pdfUrl: pdfLink?.["@_href"] ?? `https://arxiv.org/pdf/${id}`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function fetchAndParse(searchQuery: string): Promise<Paper[]> {
  const params = new URLSearchParams({
    search_query: searchQuery,
    start: "0",
    max_results: String(MAX_RESULTS),
    sortBy: "relevance",
    sortOrder: "descending",
  });
  const res = await rateLimitedFetch(`${ARXIV_API}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`arXiv API responded with ${res.status}`);
  }
  const xml = await res.text();
  const doc = parser.parse(xml);
  return asArray<XmlEntry>(doc?.feed?.entry)
    .map(parseEntry)
    .filter((p): p is Paper => p !== null);
}

export async function searchArxiv(query: string): Promise<Paper[]> {
  const key = query.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.papers;

  // Quote-safe term extraction; no boolean injection possible.
  const rawTerms = query
    .replace(/["]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
  if (rawTerms.length === 0) throw new Error("Empty query");

  // AND the content terms across all metadata fields (stopwords excluded —
  // arXiv's index ignores them, so AND-ing them yields zero results).
  const contentTerms = rawTerms.filter((t) => !STOPWORDS.has(t.toLowerCase()));
  const terms = contentTerms.length > 0 ? contentTerms : rawTerms;
  const fieldQuery = terms.map((t) => `all:${t}`).join(" AND ");

  // Multi-word queries are often paper titles. A title-phrase query ranks
  // exact titles first; OR-ing it into the field query would bury title
  // matches under thousands of abstract hits. So query separately — title
  // phrase first — and merge deduped. (The second request waits out the 3 s
  // arXiv rate limit only when the cache is cold.)
  const queries =
    rawTerms.length > 1 ? [`ti:"${rawTerms.join(" ")}"`, fieldQuery] : [fieldQuery];

  const seen = new Set<string>();
  const papers: Paper[] = [];
  for (const q of queries) {
    for (const paper of await fetchAndParse(q)) {
      if (!seen.has(paper.id) && papers.length < MAX_RESULTS) {
        seen.add(paper.id);
        papers.push(paper);
      }
    }
    if (papers.length >= MAX_RESULTS) break;
  }

  cache.set(key, { at: Date.now(), papers });
  return papers;
}
