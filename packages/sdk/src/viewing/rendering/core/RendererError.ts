import type {SDKErrorType} from "../../../base/core";

/**
 * Error payload emitted by renderer backends.
 *
 * Renderer failures are reported through the SDK result shape so callers can
 * branch on the error category without depending on backend-specific exception
 * types.
 */
export interface RendererError {
  /** Always `false` for renderer error events. */
  ok: false;

  /** SDK-level category for the renderer failure. */
  type: SDKErrorType;

  /** Human-readable error message. */
  error: string;
}
