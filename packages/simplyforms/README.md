# simplyforms

Official JavaScript/TypeScript client for [SimplyForms](https://www.simplyforms.dev) — submit
form data with one call from the **browser, Node 20+, Bun, Deno, or any Edge runtime**.

- **Zero dependencies**, tiny, tree-shakeable (ESM + CJS).
- **Typed errors** you can branch on with `instanceof`.
- **Built-in retries** (exponential backoff + jitter, honors `Retry-After`) and **timeouts**.
- **No build step required** via the CDN bundle.

> Installable as `simplyforms` (recommended) or the equivalent alias `@simplyforms/sdk`.

## Install

```bash
npm install simplyforms
# pnpm add simplyforms · yarn add simplyforms · bun add simplyforms
```

## Quickstart

```ts
import { SimplyForms } from 'simplyforms';

const sf = new SimplyForms('YOUR_FORM_ID');

const result = await sf.submit({
  email: 'jane@example.com',
  message: 'Hello!',
});

console.log(result.success); // true
if (result.redirectUrl) {
  // the form has a configured redirect destination
}
```

`YOUR_FORM_ID` is the form's UUID **or** its 10-character short ID — both work.

## Configuration

```ts
const sf = new SimplyForms({
  formId: 'YOUR_FORM_ID',     // default form; can be overridden per call
  baseUrl: 'https://api.simplyforms.dev', // default
  timeout: 30_000,            // ms; default 30s
  retries: { maxRetries: 2 }, // or a number; default { maxRetries: 2 }
  headers: { 'x-trace': 'abc' },
  fetch: customFetch,         // optional; defaults to globalThis.fetch
  debug: false,
});
```

| Option    | Type                          | Default                        | Notes                                          |
| --------- | ----------------------------- | ------------------------------ | ---------------------------------------------- |
| `formId`  | `string`                      | —                              | Default form; per-call ID overrides it.        |
| `baseUrl` | `string`                      | `https://api.simplyforms.dev`  | Point at staging or self-host.                 |
| `timeout` | `number`                      | `30000`                        | Per-request, composes with a caller signal.    |
| `retries` | `RetryConfig \| number`       | `{ maxRetries: 2 }`            | See [Retries](#retries--timeouts).             |
| `headers` | `Record<string, string>`      | `{}`                           | Merged into every request.                     |
| `fetch`   | `typeof fetch`                | `globalThis.fetch`             | Inject for tests / non-standard runtimes.      |
| `debug`   | `boolean`                     | `false`                        | Trace requests via `console.debug`.            |

The form ID resolves as **explicit argument → client default**:

```ts
const sf = new SimplyForms({ baseUrl: '…' });
await sf.submit('FORM_ID', { email });   // explicit ID
```

## Submitting data

### Plain object (JSON, default)

```ts
await sf.submit({ email, message, plan: 'pro' });
```

### URL-encoded

```ts
await sf.submit({ email, message }, { encoding: 'form' });
```

### From an HTML form (`FormData`)

```ts
const form = document.querySelector('form')!;
await sf.submit(new FormData(form));
```

### File uploads

Pass `files` to force a multipart request (max 5 files, 25 MB each; allowed types:
jpeg/png/gif/webp, pdf, txt, csv, json, xml):

```ts
await sf.submit(
  { email, message },
  {
    files: {
      resume: fileInput.files[0],                  // a File/Blob
      attachments: [blobA, blobB],                 // arrays are fine
      logo: { value: bytes, filename: 'logo.png', contentType: 'image/png' },
    },
  },
);
```

### Spam protection (Cloudflare Turnstile)

If the form has Turnstile enabled, pass the widget token — it's injected as
`cf-turnstile-response`:

```ts
await sf.submit({ email, message }, { turnstileToken });
```

> **Honeypot:** the backend treats fields named `_honey` and `_gotcha` as bot traps. The SDK
> never sends them automatically — just don't name a real field that.

## Error handling

Every failure is a typed subclass of `SimplyFormsError`:

```ts
import {
  SimplyForms,
  SimplyFormsValidationError,
  SimplyFormsRateLimitError,
  SimplyFormsNotFoundError,
  SimplyFormsTimeoutError,
} from 'simplyforms';

try {
  await sf.submit({ email });
} catch (err) {
  if (err instanceof SimplyFormsRateLimitError) {
    console.log('retry after', err.retryAfter, 'seconds');
  } else if (err instanceof SimplyFormsValidationError) {
    console.log(err.status, err.message); // 400, server message
  } else if (err instanceof SimplyFormsNotFoundError) {
    // 404 — wrong form ID
  } else if (err instanceof SimplyFormsTimeoutError) {
    // timed out
  } else if (err instanceof SimplyFormsError) {
    console.log(err.code, err.message);
  }
}
```

| Class                          | When                         | Extra fields                          |
| ------------------------------ | ---------------------------- | ------------------------------------- |
| `SimplyFormsValidationError`   | HTTP 400 (incl. Turnstile)   | `status`, `body`, `requestId`         |
| `SimplyFormsNotFoundError`     | HTTP 404                      | `status`, `body`, `requestId`         |
| `SimplyFormsRateLimitError`    | HTTP 429                      | `retryAfter`, `status`, …             |
| `SimplyFormsServerError`       | HTTP 5xx                     | `status`, `body`, `requestId`         |
| `SimplyFormsConnectionError`   | network failure              | `cause`                               |
| `SimplyFormsTimeoutError`      | timeout fired                | `cause`                               |

Every error also carries a stable `code` (`'validation_error'`, `'rate_limited'`, `'not_found'`,
`'server_error'`, `'connection_error'`, `'timeout'`, `'too_many_fields'`, `'config_error'`).

## Retries & timeouts

- Retries on **429, 5xx, and network/timeout** errors; never on other 4xx.
- Exponential backoff with full jitter; respects the `Retry-After` header on 429.
- Per-call overrides:

```ts
await sf.submit(data, { retries: 0, timeout: 5_000 });
await sf.submit(data, { retries: { maxRetries: 3, retryNetworkErrors: false } });
```

> **Double-submit caveat:** `submit()` is **not idempotent**. A retried 5xx/network error
> *could* create a duplicate submission if the first request was actually received. 429s are
> always safe to retry (rejected, not processed). Set `retries: 0` if you need exactly-once.

## Aborting

```ts
const controller = new AbortController();
const promise = sf.submit(data, { signal: controller.signal });
controller.abort(); // composes with the internal timeout
```

## Runtime support

| Runtime           | Supported            |
| ----------------- | -------------------- |
| Browsers          | ✅ (modern, ESM/CDN) |
| Node              | ✅ 20+               |
| Bun / Deno        | ✅                   |
| Edge (CF Workers, Vercel Edge) | ✅      |

Relies only on Web-standard globals (`fetch`, `FormData`, `Blob`, `AbortController`). Inject a
`fetch` via the `fetch` option for runtimes without a global one.

## Browser via CDN

```html
<script
  src="https://unpkg.com/simplyforms@0.1.0/dist/browser/simplyforms.global.js"
  integrity="sha384-…"
  crossorigin="anonymous"
></script>
<script>
  const sf = new SimplyForms.SimplyForms('YOUR_FORM_ID');
  sf.submit({ email: 'jane@example.com', message: 'Hi' });
</script>
```

> Pin an exact version and add a [Subresource Integrity](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity)
> `integrity` hash so a CDN compromise can't swap the script under you.

## Framework usage

These are copy-paste patterns — the SDK ships no framework-specific code.

<details><summary>React</summary>

```tsx
const sf = new SimplyForms('YOUR_FORM_ID');

function ContactForm() {
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await sf.submit(new FormData(e.currentTarget));
  }
  return <form onSubmit={onSubmit}>…</form>;
}
```

</details>

<details><summary>Next.js (Route Handler / Server Action)</summary>

```ts
import { SimplyForms } from 'simplyforms';
const sf = new SimplyForms('YOUR_FORM_ID');

export async function POST(req: Request) {
  await sf.submit(await req.json());
  return Response.json({ ok: true });
}
```

</details>

## License

[Apache-2.0](./LICENSE) © Simplyxity Ltd
