/**
 * Public type surface for the SimplyForms client.
 *
 * Everything here is runtime-free: the SDK ships zero dependencies and relies
 * only on Web-standard globals (fetch, FormData, Blob, AbortController).
 */

/** Retry/backoff tuning. Pass a number as shorthand for `{ maxRetries: n }`. */
export interface RetryConfig {
  /** Max retry attempts after the first try. Default: 2. */
  maxRetries?: number;
  /** Base backoff in ms (exponential + full jitter). Default: 500. */
  baseDelay?: number;
  /** Backoff ceiling in ms. Default: 8000. */
  maxDelay?: number;
  /** Retry on network/timeout failures (not just 429/5xx). Default: true. */
  retryNetworkErrors?: boolean;
}

/** Client configuration. A bare string is shorthand for `{ formId }`. */
export interface SimplyFormsConfig {
  /** Default form ID (UUID or 10-char short ID) used when `submit()` is called without one. */
  formId?: string;
  /** API base URL. Default: `https://api.simplyforms.dev`. */
  baseUrl?: string;
  /** Per-request timeout in ms (composes with a caller-provided signal). Default: 30000. */
  timeout?: number;
  /** Retry policy, or a number shorthand for `maxRetries`. Default: `{ maxRetries: 2 }`. */
  retries?: RetryConfig | number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (tests / runtimes without a global fetch). Default: `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Emit debug traces via `console.debug`. Default: false. */
  debug?: boolean;
}

/** A single file to attach. Accepts a `File`/`Blob`, or a descriptor with raw bytes. */
export type FileInput =
  | File
  | Blob
  | {
      value: Blob | Uint8Array | ArrayBuffer;
      filename?: string;
      contentType?: string;
    };

/** The submission payload: a plain object, a pre-built `FormData`, or a pre-serialized JSON string. */
export type SubmitData = Record<string, unknown> | FormData | string;

/** Per-call options for `submit()`. */
export interface SubmitOptions {
  /** Cloudflare Turnstile token; injected into the payload as `cf-turnstile-response`. */
  turnstileToken?: string;
  /** Files to attach (forces a multipart request). Keyed by field name; values may be arrays. */
  files?: Record<string, FileInput | FileInput[]>;
  /** Body encoding for object payloads. `'form'` = urlencoded. Default: `'json'` (multipart if files). */
  encoding?: 'json' | 'form';
  /** Abort signal, composed with the internal timeout. */
  signal?: AbortSignal;
  /** Per-call timeout override in ms. */
  timeout?: number;
  /** Per-call headers (merged last; win on conflict). */
  headers?: Record<string, string>;
  /** Per-call retry override. */
  retries?: RetryConfig | number;
}

/** Successful submission result. */
export interface SubmitResult {
  success: true;
  /** Human-readable confirmation (absent on the honeypot path). */
  message?: string;
  /** Destination configured on the form, if any. */
  redirectUrl?: string;
}
