import { Redis } from "@upstash/redis";

/**
 * Upstash Redis cache tier. Fully optional: when the env vars are absent
 * (local dev, misconfigured deploy) every call quietly degrades to a no-op
 * and the app behaves exactly as it did without a cache.
 */

let client: Redis | null = null;
let warned = false;

export function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warned) {
      warned = true;
      console.info("[cache] UPSTASH_REDIS_REST_* not set; caching disabled.");
    }
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch (err) {
    console.warn(`[cache] GET failed for ${key}:`, err);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn(`[cache] SET failed for ${key}:`, err);
  }
}

/** Normalizes a search query into a stable cache key. */
export function searchKey(query: string): string {
  return `v1:search:${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

/** Cache key for a paper summary, keyed on the arXiv id when present. */
export function summaryKey(id: string, title: string): string {
  const clean = /^[\w.\-/]+$/.test(id)
    ? id
    : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  return `v1:summary:${clean}`;
}
