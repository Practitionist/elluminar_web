import { Redis } from "@upstash/redis";

import { env } from "@/env";

/**
 * BetterAuth `secondaryStorage` backed by Upstash Redis (HTTP — serverless-safe
 * on Netlify functions). Gives the rate limiter a store shared across instances,
 * so brute-force limits hold globally instead of per-lambda-instance.
 *
 * Returns null when Upstash is not configured (local dev) — callers fall back to
 * better-auth's in-memory limiter, which is acceptable pre-production (issue #35).
 */
export function createAuthSecondaryStorage():
  | {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string, ttl?: number) => Promise<void>;
      delete: (key: string) => Promise<void>;
    }
  | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  return {
    get: async (key) => await redis.get<string>(key),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, { ex: ttl });
      else await redis.set(key, value);
    },
    delete: async (key) => {
      await redis.del(key);
    },
  };
}
