/**
 * Token-bucket rate limiter for the Fully Cloud REST API.
 * Limit: max 10 req/sec, 100 req/min.
 * We use 8 req/sec conservatively to stay well under the limit.
 */

const TOKENS_PER_SEC = 8;
const REFILL_INTERVAL_MS = 1_000 / TOKENS_PER_SEC; // 125 ms per token

let tokens = TOKENS_PER_SEC;
let lastRefill = Date.now();

function refill(): void {
  const now = Date.now();
  const elapsed = now - lastRefill;
  const newTokens = Math.floor(elapsed / REFILL_INTERVAL_MS);
  if (newTokens > 0) {
    tokens = Math.min(TOKENS_PER_SEC, tokens + newTokens);
    lastRefill = now;
  }
}

function acquireToken(): Promise<void> {
  return new Promise((resolve) => {
    const attempt = () => {
      refill();
      if (tokens > 0) {
        tokens--;
        resolve();
      } else {
        setTimeout(attempt, REFILL_INTERVAL_MS);
      }
    };
    attempt();
  });
}

const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 3;

/**
 * Wraps a Fully Cloud API call with rate limiting and 429 retry logic.
 */
export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireToken();
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RateLimitError && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Fully Cloud rate limit: max retries exceeded");
}

export class RateLimitError extends Error {
  constructor() {
    super("Fully Cloud API rate limit exceeded (429)");
  }
}

export { TIMEOUT_MS as CLOUD_TIMEOUT_MS };
