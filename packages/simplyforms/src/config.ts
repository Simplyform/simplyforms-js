/** Defaults and config normalization. */
import type { RetryConfig, SimplyFormsConfig } from './types';

export const DEFAULT_BASE_URL = 'https://api.simplyforms.dev';
export const DEFAULT_TIMEOUT = 30_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_BASE_DELAY = 500;
export const DEFAULT_MAX_DELAY = 8_000;

/** The exact field name the backend reads the Cloudflare Turnstile token from. */
export const TURNSTILE_FIELD = 'cf-turnstile-response';
/** Server-enforced cap; checked client-side to save a round trip. */
export const MAX_FIELDS = 200;

export interface NormalizedConfig {
  formId?: string;
  baseUrl: string;
  timeout: number;
  retries: Required<RetryConfig>;
  headers: Record<string, string>;
  fetch?: typeof fetch;
  debug: boolean;
}

export function normalizeRetries(
  retries: RetryConfig | number | undefined,
): Required<RetryConfig> {
  if (typeof retries === 'number') {
    return {
      maxRetries: retries,
      baseDelay: DEFAULT_BASE_DELAY,
      maxDelay: DEFAULT_MAX_DELAY,
      retryNetworkErrors: true,
    };
  }
  return {
    maxRetries: retries?.maxRetries ?? DEFAULT_MAX_RETRIES,
    baseDelay: retries?.baseDelay ?? DEFAULT_BASE_DELAY,
    maxDelay: retries?.maxDelay ?? DEFAULT_MAX_DELAY,
    retryNetworkErrors: retries?.retryNetworkErrors ?? true,
  };
}

export function normalizeConfig(
  config: SimplyFormsConfig | string | undefined,
): NormalizedConfig {
  const c: SimplyFormsConfig =
    typeof config === 'string' ? { formId: config } : (config ?? {});

  // Only bind the *global* fetch — a caller-supplied fetch may rely on its own
  // `this`, and browsers throw "Illegal invocation" for an unbound global fetch.
  let resolvedFetch: typeof fetch | undefined;
  if (c.fetch) {
    resolvedFetch = c.fetch;
  } else if (typeof globalThis.fetch === 'function') {
    resolvedFetch = globalThis.fetch.bind(globalThis);
  }

  return {
    formId: c.formId,
    baseUrl: stripTrailingSlash(c.baseUrl ?? DEFAULT_BASE_URL),
    timeout: c.timeout ?? DEFAULT_TIMEOUT,
    retries: normalizeRetries(c.retries),
    headers: { ...c.headers },
    fetch: resolvedFetch,
    debug: c.debug ?? false,
  };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
