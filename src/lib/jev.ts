import type { Paper, RankedPaper } from "./types";

// Jev is served through OpenRouter's Decisions API.
const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const MODEL = "typesafe/jev-1.13";
const LEVELS = [
  "Unrelated to the query",
  "Tangentially related; shares a field or keyword at most",
  "Clearly relevant; a researcher with this query would likely open it",
  "Directly on-topic; one of the best possible matches for the query",
] as const;

interface ScoreAnswer {
  type: "score";
  score: number; // expected level, 0..LEVELS.length-1 (fractional)
  confidence: number; // 0..1
}

interface SystemOneResponse {
  answers: Record<string, ScoreAnswer | { type: string }>;
}

/**
 * Ranks papers for a query with Jev (TypeSafe System One).
 *
 * One API call fans out one Score question per paper, all evaluated in
 * parallel against a shared state (query + numbered titles). Papers are
 * sorted by score x confidence, per the product spec.
 *
 * Returns null when OPENROUTER_API_KEY is missing or the API fails, so the
 * caller can gracefully fall back to arXiv's own relevance order.
 */
export async function rankPapers(
  query: string,
  papers: Paper[],
): Promise<RankedPaper[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || papers.length === 0) return null;

  const refs = papers.map((_, i) => `P${i + 1}`);
  const state = {
    user_query: query,
    candidate_papers: papers.map((p, i) => ({ ref: refs[i], title: p.title })),
  };

  const questions: Record<string, unknown> = {};
  papers.forEach((p, i) => {
    questions[`paper_${i}`] = {
      type: "score",
      instructions: `How relevant is candidate paper ${refs[i]} to the user_query? Judge topical relevance only; ignore recency and citation count.`,
      criteria: [...LEVELS],
    };
  });

  let data: SystemOneResponse;
  try {
    const res = await fetch(DECISIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Articulate",
      },
      body: JSON.stringify({ model: MODEL, state, questions }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.error(`Jev ranking failed: ${res.status} ${await res.text()}`);
      return null;
    }
    data = (await res.json()) as SystemOneResponse;
  } catch (err) {
    console.error("Jev ranking error:", err);
    return null;
  }

  const maxLevel = LEVELS.length - 1;
  const ranked: RankedPaper[] = papers.map((p, i) => {
    const answer = data.answers?.[`paper_${i}`];
    if (!answer || answer.type !== "score") {
      return { ...p, score: null, confidence: null };
    }
    const { score, confidence } = answer as ScoreAnswer;
    return {
      ...p,
      score: Math.round((score / maxLevel) * 1000) / 10, // 0–100
      confidence: Math.round(confidence * 1000) / 1000, // 0–1
    };
  });

  // Sort by score x confidence (highest first); unscored papers sink.
  ranked.sort((a, b) => {
    const ka = a.score === null ? -1 : (a.score / 100) * (a.confidence ?? 0);
    const kb = b.score === null ? -1 : (b.score / 100) * (b.confidence ?? 0);
    return kb - ka;
  });

  return ranked;
}
