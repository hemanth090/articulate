import { NextResponse } from "next/server";
import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { cacheGet, cacheSet, summaryKey } from "@/lib/cache";
import { checkLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert science communicator writing for non-native English speakers and technical readers who want to improve their English articulation.

Write a clear, articulate summary of the given research paper in impeccable, modern academic English. Model excellent writing: precise vocabulary, varied but controlled sentence structure, no jargon without explanation, no filler.

Format in Markdown, exactly these sections:
## Overview
Two to four sentences: what the paper does and why it exists.
## Key Ideas
3 to 5 bullets, each one crisp sentence.
## Method
One short paragraph on how the work is done.
## Results
What was found or shown; include concrete numbers when present.
## Why It Matters
One short paragraph on impact and applications.

Keep the whole summary under 350 words. Never invent results not present in the source material. Never use em dashes or en dashes anywhere; use commas, colons, semicolons, or periods instead.`;

interface SummarizeRequest {
  id: string;
  title: string;
  abstract: string;
  authors?: string[];
}

/**
 * Best-effort fetch of clean full text from arxiv-txt.org.
 * Falls back to null quickly; the abstract alone is enough to summarize.
 */
async function fetchFullText(id: string): Promise<string | null> {
  if (!/^[\w.\-/]+$/.test(id)) return null;
  try {
    const res = await fetch(`https://arxiv-txt.org/abs/${id}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length < 500) return null;
    return text.slice(0, 12000);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: SummarizeRequest;
  try {
    body = (await req.json()) as SummarizeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, title, abstract } = body;
  if (!title || !abstract) {
    return NextResponse.json(
      { error: "Both title and abstract are required." },
      { status: 400 },
    );
  }

  const { ok, retryAfter } = await checkLimit("summary", clientIp(req));
  if (!ok) {
    return NextResponse.json(
      { error: `Slow down a little; try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // Repeat summaries (Paper of the day, popular papers) stream straight
  // from cache: zero Groq tokens, zero arxiv-txt fetch.
  const key = summaryKey(id ?? "", title);
  const cached = await cacheGet<string>(key);
  if (cached) {
    return new Response(cached, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "x-cache": "HIT" },
    });
  }

  const fullText = id ? await fetchFullText(id) : null;
  const source = fullText
    ? `Full text (truncated):\n${fullText}`
    : `Abstract:\n${abstract}`;

  const result = streamText({
    model: groq("openai/gpt-oss-120b"),
    system: SYSTEM_PROMPT,
    prompt: `Title: ${title}\nAuthors: ${(body.authors ?? []).join(", ")}\n\n${source}`,
  });

  // Belt and braces: even if the model slips, no dash longer than a
  // hyphen ever reaches the client.
  const noDashes = new TransformStream<string, string>({
    transform(chunk, controller) {
      controller.enqueue(
        chunk.replace(/\s*—\s*/g, ", ").replace(/–/g, "-"),
      );
    },
  });

  // Accumulate the sanitized text and persist it when the stream ends
  // (skipped if the client disconnects early, which is fine).
  let full = "";
  const collect = new TransformStream<string, string>({
    transform(chunk, controller) {
      full += chunk;
      controller.enqueue(chunk);
    },
    flush() {
      if (full.length > 200) void cacheSet(key, full, 30 * 24 * 60 * 60);
    },
  });

  return new Response(result.textStream.pipeThrough(noDashes).pipeThrough(collect), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "x-cache": "MISS" },
  });
}
