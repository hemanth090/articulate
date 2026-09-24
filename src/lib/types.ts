export interface Paper {
  /** Bare arXiv id, e.g. "2401.12345" (version stripped). */
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string; // ISO date
  absUrl: string;
  pdfUrl: string;
}

export interface RankedPaper extends Paper {
  /** Relevance score from Jev, normalized to 0–100. Null when Jev is unavailable. */
  score: number | null;
  /** Jev confidence in its own judgment, 0–1. Null when Jev is unavailable. */
  confidence: number | null;
}

export interface SearchResponse {
  query: string;
  ranked: boolean;
  papers: RankedPaper[];
}

export interface ApiError {
  error: string;
}
