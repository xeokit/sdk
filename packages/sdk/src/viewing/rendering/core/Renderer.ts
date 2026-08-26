import type {SDKResult} from "../../../base/core";
import type {PickParams, PickResult, View, Viewer} from "../../viewer";
import type {RendererEvents} from "./RendererEvents";

/**
 * Backend-neutral renderer contract.
 *
 * This is the surface expected by higher-level viewer, Studio, and spatial
 * picking code. Concrete backends such as WebGL or WebGPU can expose richer
 * backend-specific APIs in their own modules while still satisfying this
 * shared contract.
 */
export interface Renderer {
  /** Enables backend error logging when supported by the implementation. */
  logging: boolean;

  /** Lifecycle, context, render, and error events emitted by the renderer. */
  readonly events: RendererEvents<any>;

  /** Viewer currently attached to the renderer, or `null` when detached. */
  readonly viewer: Viewer | null;

  /** Whether the renderer currently has active rendering state. */
  readonly rendering: boolean;

  /**
   * Attaches a Viewer to the renderer.
   *
   * Implementations usually subscribe to Viewer and Scene events during this
   * call, allocate backend state, and start rendering when the Viewer has a
   * Scene.
   *
   * @param viewer - Viewer to render.
   * @returns An SDK result indicating whether attachment succeeded.
   */
  attachViewer(viewer: Viewer): SDKResult<void>;

  /**
   * Detaches the current Viewer, if any, and releases Viewer-bound state.
   */
  detachViewer(): void;

  /**
   * Permanently releases renderer resources.
   *
   * A destroyed renderer should not be reused.
   */
  destroy(): void;

  /**
   * Performs a renderer-backed pick in a View.
   *
   * This is the path used for pick modes that require backend readback, such as
   * snapping to vertices or edges.
   *
   * @param view - View whose canvas coordinates are being picked.
   * @param pickParams - Picking options and canvas coordinates.
   * @returns An SDK result containing the pick hit, or a renderer error.
   */
  pick(view: View, pickParams: PickParams): SDKResult<PickResult>;

  /**
   * Captures the current contents of a View as an image data URL.
   *
   * @param view - View to snapshot.
   * @returns An SDK result containing the encoded snapshot.
   */
  getSnapshot(view: View): SDKResult<string>;
}
