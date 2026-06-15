/** The `SimplyForms` client — the public entry point. */
import { MAX_FIELDS, normalizeConfig, normalizeRetries, TURNSTILE_FIELD } from './config';
import type { NormalizedConfig } from './config';
import { SimplyFormsError, SimplyFormsValidationError } from './errors';
import { performRequest } from './http';
import { withRetry } from './retry';
import type {
  FileInput,
  SimplyFormsConfig,
  SubmitData,
  SubmitOptions,
  SubmitResult,
} from './types';

export class SimplyForms {
  readonly #config: NormalizedConfig;

  constructor(config?: SimplyFormsConfig | string) {
    this.#config = normalizeConfig(config);
  }

  submit(data: SubmitData, options?: SubmitOptions): Promise<SubmitResult>;
  submit(
    formId: string,
    data: SubmitData,
    options?: SubmitOptions,
  ): Promise<SubmitResult>;
  // `async` so even synchronous argument/validation errors surface as a
  // rejected promise — callers can rely on a single `.catch()`/`try`.
  async submit(
    a: SubmitData | string,
    b?: SubmitData | SubmitOptions,
    c?: SubmitOptions,
  ): Promise<SubmitResult> {
    const { formId, data, options } = this.#resolveArgs(a, b, c);
    return this.#submit(formId, data, options);
  }

  #resolveArgs(
    a: SubmitData | string,
    b?: SubmitData | SubmitOptions,
    c?: SubmitOptions,
  ): { formId: string; data: SubmitData; options: SubmitOptions } {
    let formId: string | undefined;
    let data: SubmitData;
    let options: SubmitOptions;

    if (typeof a === 'string') {
      // submit(formId, data, options)
      formId = a;
      data = b as SubmitData;
      options = c ?? {};
    } else {
      // submit(data, options)
      formId = this.#config.formId;
      data = a;
      options = (b as SubmitOptions | undefined) ?? {};
    }

    if (!formId) {
      throw new SimplyFormsError(
        'No form ID provided. Pass one to submit(formId, data), or set { formId } on the client.',
        'config_error',
      );
    }
    if (data === undefined || data === null) {
      throw new SimplyFormsError('No submission data provided.', 'config_error');
    }

    return { formId, data, options };
  }

  async #submit(
    formId: string,
    data: SubmitData,
    options: SubmitOptions,
  ): Promise<SubmitResult> {
    const fetchImpl = this.#config.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new SimplyFormsError(
        'No fetch implementation found. Provide one via the { fetch } client option.',
        'config_error',
      );
    }

    const url = `${this.#config.baseUrl}/v1/forms/${encodeURIComponent(formId)}/submissions`;
    const { body, headers: bodyHeaders } = this.#buildBody(data, options);
    const headers = { ...this.#config.headers, ...bodyHeaders, ...options.headers };
    const timeout = options.timeout ?? this.#config.timeout;
    const retries =
      options.retries !== undefined
        ? normalizeRetries(options.retries)
        : this.#config.retries;

    return withRetry(
      () =>
        performRequest({
          url,
          body,
          headers,
          timeout,
          signal: options.signal,
          fetchImpl,
          debug: this.#config.debug,
        }),
      retries,
    );
  }

  #buildBody(
    data: SubmitData,
    options: SubmitOptions,
  ): { body: BodyInit; headers: Record<string, string> } {
    const token = options.turnstileToken;
    const hasFiles = Boolean(options.files && Object.keys(options.files).length > 0);

    // Multipart: explicit FormData, or any submission with file attachments.
    if (data instanceof FormData || hasFiles) {
      const form =
        data instanceof FormData ? data : objectToFormData(asRecord(data, 'multipart'));
      if (options.files) appendFiles(form, options.files);
      if (token) form.set(TURNSTILE_FIELD, token);
      // No Content-Type header — fetch sets the multipart boundary itself.
      return { body: form, headers: {} };
    }

    // URL-encoded.
    if (options.encoding === 'form') {
      const record = asRecord(data, 'urlencoded');
      assertFieldCount(record);
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(record)) {
        appendParam(params, key, value);
      }
      if (token) params.set(TURNSTILE_FIELD, token);
      return {
        body: params.toString(),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      };
    }

    // Pre-serialized JSON string.
    if (typeof data === 'string') {
      if (!token) {
        return { body: data, headers: { 'content-type': 'application/json' } };
      }
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data) as Record<string, unknown>;
      } catch {
        throw new SimplyFormsError(
          'turnstileToken cannot be applied to a non-JSON string body.',
          'config_error',
        );
      }
      parsed[TURNSTILE_FIELD] = token;
      return {
        body: JSON.stringify(parsed),
        headers: { 'content-type': 'application/json' },
      };
    }

    // Plain object → JSON.
    const record = asRecord(data, 'json');
    assertFieldCount(record);
    const payload = token ? { ...record, [TURNSTILE_FIELD]: token } : record;
    return {
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    };
  }
}

function asRecord(data: SubmitData, mode: string): Record<string, unknown> {
  if (data && typeof data === 'object' && !(data instanceof FormData)) {
    return data as Record<string, unknown>;
  }
  throw new SimplyFormsError(
    `Expected an object of form fields for a ${mode} submission.`,
    'config_error',
  );
}

function assertFieldCount(record: Record<string, unknown>): void {
  const count = Object.keys(record).length;
  if (count > MAX_FIELDS) {
    throw new SimplyFormsValidationError(
      `Submission has ${count} fields, exceeding the ${MAX_FIELDS}-field limit.`,
      400,
      undefined,
      undefined,
      'too_many_fields',
    );
  }
}

function objectToFormData(record: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, toFieldValue(item));
    } else {
      form.append(key, toFieldValue(value));
    }
  }
  return form;
}

function toFieldValue(value: unknown): string | Blob {
  if (value instanceof Blob) return value;
  if (typeof value === 'string') return value;
  return String(value);
}

function appendParam(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) params.append(key, stringifyScalar(item));
  } else {
    params.append(key, stringifyScalar(value));
  }
}

function stringifyScalar(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}

function appendFiles(
  form: FormData,
  files: Record<string, FileInput | FileInput[]>,
): void {
  for (const [field, input] of Object.entries(files)) {
    const list = Array.isArray(input) ? input : [input];
    for (const file of list) appendFile(form, field, file);
  }
}

function appendFile(form: FormData, field: string, file: FileInput): void {
  // `File` is a `Blob`, so this handles both.
  if (file instanceof Blob) {
    form.append(field, file);
    return;
  }
  const { value, filename, contentType } = file;
  const blob =
    value instanceof Blob
      ? value
      : new Blob([value as BlobPart], contentType ? { type: contentType } : undefined);
  if (filename === undefined) {
    form.append(field, blob);
  } else {
    form.append(field, blob, filename);
  }
}
