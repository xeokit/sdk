import type {Viewer} from "../../viewer";

/**
 * Configuration for {@link WebGPURenderer}.
 */
export interface WebGPURendererParams {
  /**
   * Viewer to attach during construction.
   *
   * Attachment currently returns {@link base!core.SDKErrorType.NotSupported}
   * until the WebGPU rendering pipeline is implemented.
   */
  viewer?: Viewer;

  /**
   * Enables renderer error logging.
   *
   * Default value is `true`.
   */
  logging?: boolean;
}
