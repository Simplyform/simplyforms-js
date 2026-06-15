import { describe, expect, it, vi } from 'vitest';
import {
  SimplyForms,
  SimplyFormsConnectionError,
  SimplyFormsNotFoundError,
  SimplyFormsServerError,
  SimplyFormsTimeoutError,
  SimplyFormsValidationError,
} from '../src';
import type { SimplyFormsConfig } from '../src';

function ok(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function err(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function clientWith(
  fetchMock: ReturnType<typeof vi.fn>,
  config: Partial<SimplyFormsConfig> = {},
): SimplyForms {
  return new SimplyForms({
    formId: 'FORM',
    fetch: fetchMock as unknown as typeof fetch,
    ...config,
  });
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): {
  url: string;
  init: RequestInit;
} {
  const call = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url: call[0], init: call[1] };
}

describe('URL building', () => {
  it('targets the submissions endpoint with the default form ID', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock).submit({ a: 1 });
    expect(lastCall(fetchMock).url).toBe(
      'https://api.simplyforms.dev/v1/forms/FORM/submissions',
    );
  });

  it('works with a 10-char short ID and a custom baseUrl (trailing slash trimmed)', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock, { baseUrl: 'https://staging.example.com/' }).submit(
      'abcDEF1234',
      { a: 1 },
    );
    expect(lastCall(fetchMock).url).toBe(
      'https://staging.example.com/v1/forms/abcDEF1234/submissions',
    );
  });

  it('prefers an explicit form ID over the configured default', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock).submit('OTHER', { a: 1 });
    expect(lastCall(fetchMock).url).toContain('/forms/OTHER/');
  });
});

describe('form ID resolution', () => {
  it('throws config_error before any fetch when no form ID is available', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    const sf = new SimplyForms({ fetch: fetchMock as unknown as typeof fetch });
    await expect(sf.submit({ a: 1 })).rejects.toMatchObject({ code: 'config_error' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('encoding selection', () => {
  it('sends JSON for a plain object', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock).submit({ email: 'a@b.com', n: 2 });
    const { init } = lastCall(fetchMock);
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com', n: 2 });
  });

  it('sends urlencoded when encoding is "form"', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock).submit({ email: 'a@b.com' }, { encoding: 'form' });
    const { init } = lastCall(fetchMock);
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(init.body).toBe('email=a%40b.com');
  });

  it('sends multipart for FormData and does not set Content-Type manually', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    const fd = new FormData();
    fd.append('email', 'a@b.com');
    await clientWith(fetchMock).submit(fd);
    const { init } = lastCall(fetchMock);
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBeUndefined();
  });

  it('forwards a pre-serialized JSON string verbatim', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock).submit('FORM', '{"already":"json"}');
    expect(lastCall(fetchMock).init.body).toBe('{"already":"json"}');
  });

  it('builds multipart with scalar fields plus attached files', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock).submit(
      { email: 'a@b.com' },
      {
        files: {
          resume: {
            value: new Uint8Array([1, 2, 3]),
            filename: 'cv.pdf',
            contentType: 'application/pdf',
          },
        },
      },
    );
    const body = lastCall(fetchMock).init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('email')).toBe('a@b.com');
    const file = body.get('resume');
    expect(file).toBeInstanceOf(Blob);
  });
});

describe('Turnstile passthrough', () => {
  it('injects the token into a JSON body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock).submit({ a: 1 }, { turnstileToken: 'TKN' });
    const body = JSON.parse(lastCall(fetchMock).init.body as string);
    expect(body['cf-turnstile-response']).toBe('TKN');
  });

  it('injects the token into a urlencoded body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock).submit(
      { a: 1 },
      { encoding: 'form', turnstileToken: 'TKN' },
    );
    expect(lastCall(fetchMock).init.body as string).toContain(
      'cf-turnstile-response=TKN',
    );
  });

  it('injects the token into a multipart body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    const fd = new FormData();
    fd.append('a', '1');
    await clientWith(fetchMock).submit(fd, { turnstileToken: 'TKN' });
    const body = lastCall(fetchMock).init.body as FormData;
    expect(body.get('cf-turnstile-response')).toBe('TKN');
  });
});

describe('success parsing', () => {
  it('reads the flat { success, message, redirectUrl } shape', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        ok({
          success: true,
          message: 'Submitted successfully',
          redirectUrl: 'https://x.test',
        }),
      ),
    );
    const res = await clientWith(fetchMock).submit({ a: 1 });
    expect(res).toEqual({
      success: true,
      message: 'Submitted successfully',
      redirectUrl: 'https://x.test',
    });
  });

  it('handles the bare honeypot { success: true } response', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    const res = await clientWith(fetchMock).submit({ _honey: '' });
    expect(res).toEqual({ success: true });
  });

  it('defensively unwraps a { success, data } envelope', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(ok({ success: true, data: { message: 'from-data' } })),
    );
    const res = await clientWith(fetchMock).submit({ a: 1 });
    expect(res.message).toBe('from-data');
  });

  it('returns success for an empty 200 body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    const res = await clientWith(fetchMock).submit({ a: 1 });
    expect(res).toEqual({ success: true });
  });
});

describe('error mapping', () => {
  it('maps 400 to a validation error with the server message', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        err(400, { success: false, error: 'Email is required;Name is required' }),
      ),
    );
    await expect(clientWith(fetchMock).submit({ a: 1 })).rejects.toMatchObject({
      name: 'SimplyFormsValidationError',
      status: 400,
      message: 'Email is required;Name is required',
    });
  });

  it('maps 404 to a not-found error', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(err(404, { error: 'Form not found' })));
    await expect(clientWith(fetchMock).submit({ a: 1 })).rejects.toBeInstanceOf(
      SimplyFormsNotFoundError,
    );
  });

  it('maps 429 to a rate-limit error with parsed retryAfter', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(err(429, { error: 'slow down' }, { 'retry-after': '7' })),
    );
    await expect(
      clientWith(fetchMock, { retries: 0 }).submit({ a: 1 }),
    ).rejects.toMatchObject({ name: 'SimplyFormsRateLimitError', retryAfter: 7 });
  });

  it('maps 5xx to a server error', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(err(503, { error: 'down' })));
    await expect(
      clientWith(fetchMock, { retries: 0 }).submit({ a: 1 }),
    ).rejects.toBeInstanceOf(SimplyFormsServerError);
  });

  it('extracts a requestId from response headers', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(err(400, { error: 'bad' }, { 'x-request-id': 'req_123' })),
    );
    await expect(clientWith(fetchMock).submit({ a: 1 })).rejects.toMatchObject({
      requestId: 'req_123',
    });
  });

  it('wraps a thrown fetch as a connection error', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('network down')));
    await expect(
      clientWith(fetchMock, { retries: 0 }).submit({ a: 1 }),
    ).rejects.toBeInstanceOf(SimplyFormsConnectionError);
  });
});

describe('client-side validation', () => {
  it('rejects more than 200 fields before any fetch', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    const data: Record<string, number> = {};
    for (let i = 0; i < 201; i += 1) data[`f${i}`] = i;
    await expect(clientWith(fetchMock).submit(data)).rejects.toMatchObject({
      name: 'SimplyFormsValidationError',
      code: 'too_many_fields',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('headers', () => {
  it('merges client and per-call headers, per-call winning', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await clientWith(fetchMock, { headers: { 'x-a': '1', 'x-b': '2' } }).submit(
      { a: 1 },
      { headers: { 'x-b': 'override', 'x-c': '3' } },
    );
    const headers = lastCall(fetchMock).init.headers as Record<string, string>;
    expect(headers['x-a']).toBe('1');
    expect(headers['x-b']).toBe('override');
    expect(headers['x-c']).toBe('3');
  });
});

describe('retries (via client)', () => {
  it('retries a 429 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(429, { error: 'slow' }))
      .mockResolvedValueOnce(ok({ success: true, message: 'ok' }));
    const res = await clientWith(fetchMock, {
      retries: { maxRetries: 2, baseDelay: 0, maxDelay: 0 },
    }).submit({ a: 1 });
    expect(res.message).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(err(400, { error: 'bad' })));
    await expect(
      clientWith(fetchMock, {
        retries: { maxRetries: 3, baseDelay: 0, maxDelay: 0 },
      }).submit({
        a: 1,
      }),
    ).rejects.toBeInstanceOf(SimplyFormsValidationError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('timeout & abort', () => {
  function hangingFetch(): ReturnType<typeof vi.fn> {
    return vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
  }

  it('throws a timeout error when the request exceeds the timeout', async () => {
    const sf = clientWith(hangingFetch(), { timeout: 10, retries: 0 });
    await expect(sf.submit({ a: 1 })).rejects.toBeInstanceOf(SimplyFormsTimeoutError);
  });

  it('propagates a caller abort as code "aborted"', async () => {
    const controller = new AbortController();
    const sf = clientWith(hangingFetch(), { timeout: 1000, retries: 0 });
    const promise = sf.submit({ a: 1 }, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('configuration errors', () => {
  it('throws config_error when the resolved fetch is not callable', async () => {
    const sf = new SimplyForms({
      formId: 'F',
      fetch: 'not-a-fetch' as unknown as typeof fetch,
    });
    await expect(sf.submit({ a: 1 })).rejects.toMatchObject({
      code: 'config_error',
    });
  });

  it('rejects turnstileToken on a non-JSON string body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ success: true })));
    await expect(
      clientWith(fetchMock).submit('FORM', 'not json', { turnstileToken: 'TKN' }),
    ).rejects.toMatchObject({ code: 'config_error' });
  });
});
