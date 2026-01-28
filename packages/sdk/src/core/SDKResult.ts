import { SDKErrorType } from "./SDKErrorType";

/**
 * Represents the outcome of an operation that may either succeed or fail.
 *
 * This type is a discriminated union with two possible states:
 *
 * - **Success result**
 *   ```ts
 *   { ok: true, value: T }
 *   ```
 *   Contains the resulting value of type `T`.
 *
 * - **Error result**
 *   ```ts
 *   { ok: false, error: string, type: SDKErrorType }
 *   ```
 *   Contains an error message and a machine-readable {@link SDKErrorType}.
 *
 * Typical usage:
 *
 * ```ts
 * const result = doThing();
 *
 * if (result.ok) {
 *   console.log("Success:", result.value);
 * } else {
 *   console.error("Failed:", result.error, "Type:", result.type);
 * }
 * ```
 *
 * @template T The type of the successful result value.
 */
export type SDKResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; type: SDKErrorType };

/**
 * A predefined successful SDKResult with an undefined value.
 */
export const SDKResultOK: { ok: true, value: any } = { ok: true, value: undefined};
