/** Retry orchestration: exponential backoff + full jitter, honoring Retry-After. */
import {
  SimplyFormsConnectionError,
  SimplyFormsRateLimitError,
  SimplyFormsServerError,
} from './errors';
import type { RetryConfig } from './types';

/** Only 429, 5xx, and (optionally) network/timeout failures are retried. */
export function isRetryable(error: unknown, retryNetworkErrors: boolean): boolean {
  if (error instanceof SimplyFormsRateLimitError) return true;
  if (error instanceof SimplyFormsServerError) return true;
  // SimplyFormsTimeoutError extends SimplyFormsConnectionError, so this covers both.
  if (error instanceof SimplyFormsConnectionError) return retryNetworkErrors;
  return false;
}

/** Full-jitter exponential backoff: random in `[0, min(max, base * 2^attempt))`. */
export function computeBackoff(attempt: number, base: number, max: number): number {
  const ceiling = Math.min(max, base * 2 ** attempt);
  return Math.random() * ceiling;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  retries: Required<RetryConfig>,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (error) {
      const canRetry =
        attempt < retries.maxRetries && isRetryable(error, retries.retryNetworkErrors);
      if (!canRetry) throw error;

      let delay = computeBackoff(attempt, retries.baseDelay, retries.maxDelay);
      // Respect the server's Retry-After as a floor.
      if (
        error instanceof SimplyFormsRateLimitError &&
        typeof error.retryAfter === 'number'
      ) {
        delay = Math.max(delay, error.retryAfter * 1000);
      }
      await sleep(delay);
      attempt += 1;
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
