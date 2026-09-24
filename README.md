# Articulate

**Read research. Speak precisely.**

Articulate helps non-native and technical readers improve their English articulation by
turning arXiv papers into clear, beautifully structured summaries.

- Type a research topic → the **official arXiv API** returns the top 20 papers.
- **Jev** (TypeSafe's System One model) re-ranks all 20 for relevance to *your* query,
  with per-paper scores and confidence — one API call, 20 parallel Score questions.
- Click any paper → a generative LLM streams a crisp, articulate summary
  (Overview · Key Ideas · Method · Results · Why It Matters).

No database. No auth. No vector store. Just two Next.js API routes.

## Stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Paper search | arXiv API (`export.arxiv.org/api/query`), Atom XML via `fast-xml-parser` |
| Ranking | TypeSafe **Jev** (`typesafe/jev-1.13`) via OpenRouter Decisions API |
| Summaries | Vercel AI SDK (`ai` + `@ai-sdk/groq`), `openai/gpt-oss-120b`, streamed |
| Deploy | Vercel |

## Setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | Where to get it |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes (summaries) | https://console.groq.com/keys |
| `OPENROUTER_API_KEY` | No (ranking) | https://openrouter.ai/keys |

Without `OPENROUTER_API_KEY` the app still works — results are shown in arXiv's own
relevance order and the UI notes that Jev is offline.

```bash
# 3. Run
npm run dev        # http://localhost:3000
```

## Deploy to Vercel

```bash
npx vercel
```

Then add `GROQ_API_KEY` and `OPENROUTER_API_KEY` in **Project → Settings → Environment
Variables**. All keys are used server-side only (API routes); nothing is exposed to the
browser.

## How it works

```
GET /api/search?q=...
  1. arXiv API: all:<terms> AND-joined, start=0, max_results=20,
     sortBy=relevance, sortOrder=descending
     — rate-limited to 1 request / 3 s, small in-memory cache
  2. Jev via OpenRouter: POST https://openrouter.ai/api/alpha/decisions
     model = typesafe/jev-1.13, state = { user_query, candidate_papers[20] },
     one Score question per paper (4 relevance levels)
     → papers sorted by score × confidence, each with score (0–100) + confidence

POST /api/summarize   { id, title, abstract, authors }
  1. Best-effort clean full text from arxiv-txt.org (4 s timeout, else abstract only)
  2. streamText() on Groq (openai/gpt-oss-120b) with an articulation-focused
     system prompt → text stream rendered live in the summary panel
```

## Notes

- arXiv's Atom namespaces are stripped during parsing (`removeNSPrefix`), and API error
  pseudo-entries are filtered out.
- The arXiv rate limiter is per serverless instance — fine for a personal/small app.
- Swap the summary model in `src/app/api/summarize/route.ts` (any AI SDK provider works).
