import { describe, expect, it } from 'vitest';
import {
  mapStatusToError,
  SimplyFormsAPIError,
  SimplyFormsConnectionError,
  SimplyFormsError,
  SimplyFormsNotFoundError,
  SimplyFormsRateLimitError,
  SimplyFormsServerError,
  SimplyFormsTimeoutError,
  SimplyFormsValidationError,
} from '../src';

describe('mapStatusToError', () => {
  it('maps 400 to a validation error using the body message', () => {
    const error = mapStatusToError(400, { error: 'bad input' });
    expect(error).toBeInstanceOf(SimplyFormsValidationError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('bad input');
    expect(error.code).toBe('validation_error');
  });

  it('maps 404 with a sensible default message', () => {
    const error = mapStatusToError(404, undefined);
    expect(error).toBeInstanceOf(SimplyFormsNotFoundError);
    expect(error.message).toBe('Form not found.');
  });

  it('maps 429 and carries retryAfter + requestId from meta', () => {
    const error = mapStatusToError(
      429,
      { error: 'slow' },
      { retryAfter: 5, requestId: 'r1' },
    );
    expect(error).toBeInstanceOf(SimplyFormsRateLimitError);
    expect((error as SimplyFormsRateLimitError).retryAfter).toBe(5);
    expect(error.requestId).toBe('r1');
  });

  it('maps 5xx to a server error', () => {
    expect(mapStatusToError(500, null)).toBeInstanceOf(SimplyFormsServerError);
    expect(mapStatusToError(503, null)).toBeInstanceOf(SimplyFormsServerError);
  });

  it('falls back to a string body as the message', () => {
    const error = mapStatusToError(400, 'raw text error');
    expect(error.message).toBe('raw text error');
  });

  it('prefers a "message" field when "error" is absent', () => {
    const error = mapStatusToError(400, { message: 'via message' });
    expect(error.message).toBe('via message');
  });
});

describe('error hierarchy', () => {
  it('keeps instanceof relationships intact', () => {
    const validation = new SimplyFormsValidationError('v');
    expect(validation).toBeInstanceOf(SimplyFormsAPIError);
    expect(validation).toBeInstanceOf(SimplyFormsError);
    expect(validation).toBeInstanceOf(Error);

    const timeout = new SimplyFormsTimeoutError();
    expect(timeout).toBeInstanceOf(SimplyFormsConnectionError);
    expect(timeout).toBeInstanceOf(SimplyFormsError);
    expect(timeout.code).toBe('timeout');
  });

  it('exposes a stable code and preserves cause', () => {
    const cause = new Error('root');
    const conn = new SimplyFormsConnectionError('boom', cause);
    expect(conn.code).toBe('connection_error');
    expect(conn.cause).toBe(cause);
  });

  it('supports a custom validation code (too_many_fields)', () => {
    const error = new SimplyFormsValidationError(
      'too many',
      400,
      undefined,
      undefined,
      'too_many_fields',
    );
    expect(error.code).toBe('too_many_fields');
  });
});
