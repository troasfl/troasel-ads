import { Redis } from "@upstash/redis";

// Upstash Redis client — auto-reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
export const redis = new Redis({
  url: process.env["UPSTASH_REDIS_REST_URL"] ?? "",
  token: process.env["UPSTASH_REDIS_REST_TOKEN"] ?? "",
});

// Deduplicate a tracking event by its natural key.
// Returns true if this is the FIRST time we've seen this key (not a duplicate).
// TTL default: 30 days (clicks) — matches architecture spec.
export async function deduplicateEvent(
  key: string,
  ttlSeconds = 30 * 24 * 60 * 60
): Promise<boolean> {
  // SET NX: only sets if key doesn't already exist
  const result = await redis.set(key, "1", {
    nx: true,
    ex: ttlSeconds,
  });
  return result === "OK";
}

// Rate-limit guard: returns remaining allowed requests, or null if limit exceeded.
// Uses a sliding window via INCR + EXPIRE.
export async function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const rateLimitKey = `rl:${identifier}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) {
    await redis.expire(rateLimitKey, windowSeconds);
  }
  const allowed = count <= maxRequests;
  return { allowed, remaining: Math.max(0, maxRequests - count) };
}
