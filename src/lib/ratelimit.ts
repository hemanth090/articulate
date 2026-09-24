import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./cache";

/**
 * IP-based rate limiting, sharing the Upstash Redis client with the cache
 * tier. Like the cache, it degrades to a no-op when Redis is not configured
 * (local dev), so nothing ever locks you out of your own machine.
 *
 * Budgets are per-IP sliding windows:
 *   search:    20 requests / minute  (hits arXiv + Jev)
 *   summarize:  6 requests / minute  (streams Groq tokens — the expensive one)
 */

export type LimitKind = "search" | "summary";

const limiters = new Map<LimitKind, Ratelimit>();

function getLimiter(kind: LimitKind): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  let limiter = limiters.get(kind);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter:
        kind === "search"
          ? Ratelimit.slidingWindow(20, "60 s")
          : Ratelimit.slidingWindow(6, "60 s"),
      prefix: `v1:ratelimit:${kind}`,
      analytics: true,
    });
    limiters.set(kind, limiter);
  }
  return limiter;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export interface LimitResult {
  ok: boolean;
  /** Seconds until the caller may retry (0 when within limits). */
  retryAfter: number;
}

export async function checkLimit(
  kind: LimitKind,
  ip: string,
): Promise<LimitResult> {
  const limiter = getLimiter(kind);
  if (!limiter) return { ok: true, retryAfter: 0 };
  try {
    const { success, reset } = await limiter.limit(ip);
    return {
      ok: success,
      retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (err) {
    // Never let the limiter itself take the product down.
    console.warn(`[ratelimit] ${kind} check failed:`, err);
    return { ok: true, retryAfter: 0 };
  }
}
