/**
 * @simplyforms/sdk — official JavaScript/TypeScript client for SimplyForms.
 *
 * @example
 * ```ts
 * import { SimplyForms } from '@simplyforms/sdk';
 *
 * const sf = new SimplyForms('YOUR_FORM_ID');
 * await sf.submit({ email: 'jane@example.com', message: 'Hello!' });
 * ```
 */
export { SimplyForms } from './client';
export { SimplyForms as default } from './client';

export {
  SimplyFormsAPIError,
  SimplyFormsConnectionError,
  SimplyFormsError,
  SimplyFormsNotFoundError,
  SimplyFormsRateLimitError,
  SimplyFormsServerError,
  SimplyFormsTimeoutError,
  SimplyFormsValidationError,
  mapStatusToError,
} from './errors';
export type { SimplyFormsErrorCode } from './errors';

export type {
  FileInput,
  RetryConfig,
  SimplyFormsConfig,
  SubmitData,
  SubmitOptions,
  SubmitResult,
} from './types';
