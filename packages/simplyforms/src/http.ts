/** The fetch wrapper: timeout + signal composition, response parsing, error mapping. */
import {
  mapStatusToError,
  SimplyFormsConnectionError,
  SimplyFormsError,
  SimplyFormsTimeoutError,
} from './errors';
import type { SubmitResult } from './types';

export interface RequestArgs {
  url: string;
  body: BodyInit;
  headers: Record<string, string>;
  timeout: number;
  signal?: AbortSignal;
  fetchImpl: typeof fetch;
  debug: boolean;
}

export async function performRequest(args: RequestArgs): Promise<SubmitResult> {
  const { url, body, headers, timeout, signal, fetchImpl, debug } = args;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeout);
  const composedSignal = combineSignals(signal, timeoutController.signal);

  try {
    if (debug) {
      console.debug(`[simplyforms] POST ${url}`);
    }

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        body,
        headers,
        signal: composedSignal,
      });
    } catch (error) {
      if (timeoutController.signal.aborted) {
        throw new SimplyFormsTimeoutError(`Request timed out after ${timeout}ms.`, error);
      }
      if (signal?.aborted) {
        throw new SimplyFormsError('The request was aborted.', 'aborted', error);
      }
      const detail = error instanceof Error ? `: ${error.message}` : '.';
      throw new SimplyFormsConnectionError(`Network request failed${detail}`, error);
    }

    const requestId =
      response.headers.get('x-request-id') ?? response.headers.get('cf-ray') ?? undefined;
    const parsed = await parseBody(response);

    if (!response.ok) {
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      throw mapStatusToError(response.status, parsed, { requestId, retryAfter });
    }

    return normalizeResult(parsed);
  } finally {
    clearTimeout(timer);
  }
}

/** Compose a caller signal with the timeout signal (AbortSignal.any + a manual fallback). */
function combineSignals(
  caller: AbortSignal | undefined,
  timeout: AbortSignal,
): AbortSignal {
  if (!caller) return timeout;

  const anyFn = (
    AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }
  ).any;
  if (typeof anyFn === 'function') {
    return anyFn([caller, timeout]);
  }

  const controller = new AbortController();
  const forward = (source: AbortSignal): void => {
    if (source.aborted) {
      controller.abort(source.reason);
    } else {
      source.addEventListener('abort', () => controller.abort(source.reason), {
        once: true,
      });
    }
  };
  forward(caller);
  forward(timeout);
  return controller.signal;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json') || looksLikeJson(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function normalizeResult(parsed: unknown): SubmitResult {
  const payload = unwrapEnvelope(parsed);
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const result: SubmitResult = { success: true };
    if (typeof record.message === 'string') result.message = record.message;
    if (typeof record.redirectUrl === 'string') result.redirectUrl = record.redirectUrl;
    return result;
  }
  return { success: true };
}

/**
 * The submit endpoint returns a flat `{ success, message, redirectUrl }`. This is
 * a defensive net for a `{ success, data }` envelope shape, should it ever apply.
 */
function unwrapEnvelope(parsed: unknown): unknown {
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if ('data' in record && !('message' in record) && !('redirectUrl' in record)) {
      return record.data;
    }
  }
  return parsed;
}

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) into seconds. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds);
  }
  const epoch = Date.parse(value);
  if (!Number.isNaN(epoch)) {
    return Math.max(0, (epoch - Date.now()) / 1000);
  }
  return undefined;
}
