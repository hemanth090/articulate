import { NextResponse } from "next/server";
import { searchArxiv } from "@/lib/arxiv";
import { rankPapers } from "@/lib/jev";
import type { SearchResponse } from "@/lib/types";
import { cacheGet, cacheSet, searchKey } from "@/lib/cache";
import { checkLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing query parameter ?q=" }, { status: 400 });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long (max 200 chars)" }, { status: 400 });
  }

  const { ok, retryAfter } = await checkLimit("search", clientIp(req));
  if (!ok) {
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // Whole-response cache: identical queries within 6h skip arXiv + Jev.
  const key = searchKey(q);
  const cached = await cacheGet<SearchResponse>(key);
  if (cached) {
    return NextResponse.json(cached, { headers: { "x-cache": "HIT" } });
  }

  let papers;
  try {
    papers = await searchArxiv(q);
  } catch (err) {
    console.error("arXiv search failed:", err);
    return NextResponse.json(
      { error: "arXiv search failed. Please try again in a few seconds." },
      { status: 502 },
    );
  }

  const ranked = await rankPapers(q, papers);
  const body: SearchResponse = ranked
    ? { query: q, ranked: true, papers: ranked }
    : {
        query: q,
        ranked: false,
        papers: papers.map((p) => ({ ...p, score: null, confidence: null })),
      };

  await cacheSet(key, body, 6 * 60 * 60);

  return NextResponse.json(body, { headers: { "x-cache": "MISS" } });
}
