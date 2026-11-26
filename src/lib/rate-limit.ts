/** Small in-memory sliding-window limiter. Fine for a single long-lived Node process. */

interface Bucket {
  hits: number[];
}

interface LimiterStore {
  __cpkLimiters?: Map<string, Map<string, Bucket>>;
}
const global = globalThis as typeof globalThis & LimiterStore;

export interface Limiter {
  /** Records one attempt. Returns `retryAfterSeconds > 0` when the key is over the limit. */
  hit(key: string): { allowed: boolean; retryAfterSeconds: number };
  /** Checks without recording. */
  peek(key: string): { allowed: boolean; retryAfterSeconds: number };
  reset(key: string): void;
}

export function createLimiter(name: string, limit: number, windowMs: number): Limiter {
  const all = (global.__cpkLimiters ??= new Map());
  const buckets = all.get(name) ?? new Map<string, Bucket>();
  all.set(name, buckets);

  const prune = (bucket: Bucket, now: number) => {
    bucket.hits = bucket.hits.filter((time) => now - time < windowMs);
  };
  const status = (bucket: Bucket, now: number) =>
    bucket.hits.length >= limit
      ? { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.hits[0] + windowMs - now) / 1000)) }
      : { allowed: true, retryAfterSeconds: 0 };

  return {
    hit(key) {
      const now = Date.now();
      const bucket = buckets.get(key) ?? { hits: [] };
      prune(bucket, now);
      const before = status(bucket, now);
      if (before.allowed) bucket.hits.push(now);
      buckets.set(key, bucket);
      if (buckets.size > 5000) {
        for (const [k, b] of buckets) {
          prune(b, now);
          if (b.hits.length === 0) buckets.delete(k);
        }
      }
      return before;
    },
    peek(key) {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket) return { allowed: true, retryAfterSeconds: 0 };
      prune(bucket, now);
      return status(bucket, now);
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}
