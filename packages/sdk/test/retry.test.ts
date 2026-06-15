import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SimplyFormsConnectionError,
  SimplyFormsNotFoundError,
  SimplyFormsRateLimitError,
  SimplyFormsServerError,
  SimplyFormsTimeoutError,
  SimplyFormsValidationError,
} from '../src';
import { computeBackoff, isRetryable, withRetry } from '../src/retry';
import type { RetryConfig } from '../src';

const RETRIES: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 10,
  maxDelay: 100,
  retryNetworkErrors: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isRetryable', () => {
  it('retries 429 and 5xx unconditionally', () => {
    expect(isRetryable(new SimplyFormsRateLimitError('x'), false)).toBe(true);
    expect(isRetryable(new SimplyFormsServerError('x', 500), false)).toBe(true);
  });

  it('retries connection/timeout errors only when enabled', () => {
    expect(isRetryable(new SimplyFormsConnectionError('x'), true)).toBe(true);
    expect(isRetryable(new SimplyFormsConnectionError('x'), false)).toBe(false);
    expect(isRetryable(new SimplyFormsTimeoutError(), true)).toBe(true);
    expect(isRetryable(new SimplyFormsTimeoutError(), false)).toBe(false);
  });

  it('never retries other 4xx', () => {
    expect(isRetryable(new SimplyFormsValidationError('x'), true)).toBe(false);
    expect(isRetryable(new SimplyFormsNotFoundError('x'), true)).toBe(false);
    expect(isRetryable(new Error('other'), true)).toBe(false);
  });
});

describe('computeBackoff', () => {
  it('stays within [0, ceiling) and respects the cap', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(computeBackoff(0, 500, 8000)).toBe(250); // 0.5 * 500
    expect(computeBackoff(2, 500, 8000)).toBe(1000); // 0.5 * 2000
    expect(computeBackoff(10, 500, 8000)).toBe(4000); // 0.5 * capped 8000
  });
});

describe('withRetry', () => {
  it('succeeds after transient failures', async () => {
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    let calls = 0;
    const fn = vi.fn(() => {
      calls += 1;
      if (calls < 3) return Promise.reject(new SimplyFormsServerError('boom', 500));
      return Promise.resolve('ok');
    });
    await expect(withRetry(fn, RETRIES, sleep)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting maxRetries', async () => {
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    const fn = vi.fn(() => Promise.reject(new SimplyFormsServerError('boom', 500)));
    await expect(
      withRetry(fn, { ...RETRIES, maxRetries: 1 }, sleep),
    ).rejects.toBeInstanceOf(SimplyFormsServerError);
    expect(fn).toHaveBeenCalledTimes(2); // initial + one retry
  });

  it('does not retry a non-retryable error', async () => {
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    const fn = vi.fn(() => Promise.reject(new SimplyFormsValidationError('bad')));
    await expect(withRetry(fn, RETRIES, sleep)).rejects.toBeInstanceOf(
      SimplyFormsValidationError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('honors Retry-After as a delay floor', async () => {
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    let calls = 0;
    const fn = vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.reject(new SimplyFormsRateLimitError('rl', 429, 2));
      return Promise.resolve('ok');
    });
    await withRetry(fn, { ...RETRIES, baseDelay: 1, maxDelay: 1 }, sleep);
    const delay = sleep.mock.calls[0][0];
    expect(delay).toBeGreaterThanOrEqual(2000);
  });
});
