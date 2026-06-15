/**
 * Typed error hierarchy. Every failure thrown by the SDK is an instance of
 * {@link SimplyFormsError}, so a single `catch` can branch with `instanceof`.
 */

/** Stable, machine-readable error codes. */
export type SimplyFormsErrorCode =
  | 'config_error'
  | 'too_many_fields'
  | 'validation_error'
  | 'not_found'
  | 'rate_limited'
  | 'server_error'
  | 'connection_error'
  | 'timeout'
  | 'aborted'
  | 'unknown_error';

/** Base class for every error the SDK throws. */
export class SimplyFormsError extends Error {
  readonly code: SimplyFormsErrorCode;
  override readonly cause?: unknown;

  constructor(
    message: string,
    code: SimplyFormsErrorCode = 'unknown_error',
    cause?: unknown,
  ) {
    super(message);
    this.name = 'SimplyFormsError';
    this.code = code;
    this.cause = cause;
    // Restore the prototype chain so `instanceof` works after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** An error returned by the API (carries the HTTP status and raw body). */
export class SimplyFormsAPIError extends SimplyFormsError {
  readonly status: number;
  readonly body?: unknown;
  readonly requestId?: string;

  constructor(
    message: string,
    code: SimplyFormsErrorCode,
    status: number,
    body?: unknown,
    requestId?: string,
  ) {
    super(message, code);
    this.name = 'SimplyFormsAPIError';
    this.status = status;
    this.body = body;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 400 — validation failure (also Turnstile and client-side field-count checks). */
export class SimplyFormsValidationError extends SimplyFormsAPIError {
  constructor(
    message: string,
    status = 400,
    body?: unknown,
    requestId?: string,
    code: SimplyFormsErrorCode = 'validation_error',
  ) {
    super(message, code, status, body, requestId);
    this.name = 'SimplyFormsValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 404 — form not found. */
export class SimplyFormsNotFoundError extends SimplyFormsAPIError {
  constructor(message: string, status = 404, body?: unknown, requestId?: string) {
    super(message, 'not_found', status, body, requestId);
    this.name = 'SimplyFormsNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 429 — rate limited. `retryAfter` is parsed from the `Retry-After` header (seconds). */
export class SimplyFormsRateLimitError extends SimplyFormsAPIError {
  readonly retryAfter?: number;

  constructor(
    message: string,
    status = 429,
    retryAfter?: number,
    body?: unknown,
    requestId?: string,
  ) {
    super(message, 'rate_limited', status, body, requestId);
    this.name = 'SimplyFormsRateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 5xx — server error. */
export class SimplyFormsServerError extends SimplyFormsAPIError {
  constructor(message: string, status: number, body?: unknown, requestId?: string) {
    super(message, 'server_error', status, body, requestId);
    this.name = 'SimplyFormsServerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The request never produced a response (network failure, DNS, CORS, etc.). */
export class SimplyFormsConnectionError extends SimplyFormsError {
  constructor(
    message: string,
    cause?: unknown,
    code: SimplyFormsErrorCode = 'connection_error',
  ) {
    super(message, code, cause);
    this.name = 'SimplyFormsConnectionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The internal timeout fired before a response arrived. */
export class SimplyFormsTimeoutError extends SimplyFormsConnectionError {
  constructor(message = 'Request timed out.', cause?: unknown) {
    super(message, cause, 'timeout');
    this.name = 'SimplyFormsTimeoutError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Map an HTTP status + parsed body to the right typed error. */
export function mapStatusToError(
  status: number,
  body: unknown,
  meta?: { requestId?: string; retryAfter?: number },
): SimplyFormsAPIError {
  const message = extractErrorMessage(body, status);
  const requestId = meta?.requestId;

  if (status === 404) {
    return new SimplyFormsNotFoundError(message, status, body, requestId);
  }
  if (status === 429) {
    return new SimplyFormsRateLimitError(
      message,
      status,
      meta?.retryAfter,
      body,
      requestId,
    );
  }
  if (status >= 500) {
    return new SimplyFormsServerError(message, status, body, requestId);
  }
  return new SimplyFormsValidationError(message, status, body, requestId);
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
  }
  if (typeof body === 'string' && body.trim()) {
    return body;
  }
  return defaultMessageForStatus(status);
}

function defaultMessageForStatus(status: number): string {
  if (status === 404) return 'Form not found.';
  if (status === 429) return 'Too many requests.';
  if (status >= 500) return 'The SimplyForms API returned a server error.';
  if (status === 400) return 'The submission was rejected (validation error).';
  return `Request failed with status ${status}.`;
}
