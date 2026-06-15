import { describe, expect, it, vi } from 'vitest';
import { SimplyFormsRateLimitError, SimplyFormsServerError } from '../src';
import { parseRetryAfter, performRequest } from '../src/http';

function request(
  fetchImpl: typeof fetch,
  overrides: Partial<Parameters<typeof performRequest>[0]> = {},
) {
  return performRequest({
    url: 'https://api.test/v1/forms/F/submissions',
    body: '{}',
    headers: { 'content-type': 'application/json' },
    timeout: 1000,
    fetchImpl,
    debug: false,
    ...overrides,
  });
}

describe('parseRetryAfter', () => {
  it('parses delta-seconds', () => {
    expect(parseRetryAfter('12')).toBe(12);
  });

  it('parses an HTTP-date into a non-negative delta', () => {
    const future = new Date(Date.now() + 30_000).toUTCString();
    const seconds = parseRetryAfter(future);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(31);
  });

  it('returns undefined for null or garbage', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('not-a-date')).toBeUndefined();
  });
});

describe('performRequest', () => {
  it('parses a successful flat body', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true, message: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ) as unknown as typeof fetch;
    await expect(request(fetchImpl)).resolves.toEqual({ success: true, message: 'ok' });
  });

  it('handles a non-JSON success body as plain success', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('thanks', { status: 200 })),
    ) as unknown as typeof fetch;
    await expect(request(fetchImpl)).resolves.toEqual({ success: true });
  });

  it('maps a 429 with Retry-After into a rate-limit error', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'slow' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '3' },
        }),
      ),
    ) as unknown as typeof fetch;
    await expect(request(fetchImpl)).rejects.toMatchObject({
      name: 'SimplyFormsRateLimitError',
      retryAfter: 3,
    });
  });

  it('maps a 500 into a server error', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: 500 })),
    ) as unknown as typeof fetch;
    await expect(request(fetchImpl)).rejects.toBeInstanceOf(SimplyFormsServerError);
  });

  it('rethrows a typed rate-limit error type', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: 429 })),
    ) as unknown as typeof fetch;
    await expect(request(fetchImpl)).rejects.toBeInstanceOf(SimplyFormsRateLimitError);
  });
});
