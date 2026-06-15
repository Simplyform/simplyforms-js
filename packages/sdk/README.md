# @simplyforms/sdk

A scoped alias of [`simplyforms`](https://www.npmjs.com/package/simplyforms) — the official
JavaScript/TypeScript client for [SimplyForms](https://www.simplyforms.dev).

Both packages expose the **identical** API; install whichever name you prefer.

```bash
npm install @simplyforms/sdk
```

```ts
import { SimplyForms } from '@simplyforms/sdk';

const sf = new SimplyForms('YOUR_FORM_ID');
await sf.submit({ email: 'jane@example.com', message: 'Hello!' });
```

👉 **Full documentation lives in the [`simplyforms`](https://www.npmjs.com/package/simplyforms)
package README.**

## License

[Apache-2.0](./LICENSE) © Simplyxity Ltd
