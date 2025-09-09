import type {Capabilities} from "../core";
import type {PickParams} from "./PickParams";
import type {PickResult} from "./PickResult";
import type {RendererObject} from "../scene";
import type {SDKError} from "../core";
import type {View} from "./View";
import type {Viewer} from "./Viewer";
import type {SceneObject} from "../scene";

/**
 * Interface defining the rendering strategy used internally by a {@link Viewer | Viewer}.
 *
 * A Viewer integrates with an implementation of this interface to manage and render geometry
 * and materials using a supported browser 3D graphics API, such as WebGL or WebGPU.
 *
 * ## Example Usage
 *
 * ```javascript
 * import { Viewer } from "@xeokit/sdk/viewer";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ }) // Or WebGPURenderer, MockRenderer, etc.
 * });
 * ```
 *
 * @internal
 */
export interface Renderer {

  /**
   * Retrieves the rendering capabilities of this Renderer.
   *
   * @internal
   * @param capabilities An object to store the retrieved capabilities.
   */
  getCapabilities(capabilities: Capabilities): void;

  /**
   * The Viewer instance currently attached to this Renderer.
   * @internal
   */
  get viewer(): Viewer;

  /**
   * Attaches a {@link Viewer | Viewer} to this Renderer.
   *
   * @param viewer The Viewer instance to attach.
   * @returns `void` if successful.
   * @returns {@link core!SDKError | SDKError} if:
   * - A Viewer is already attached.
   * - The given Viewer is attached to another Renderer.
   * @internal
   */
  attachViewer(viewer: Viewer): void | SDKError;

  /**
   * Detaches the currently attached {@link Viewer | Viewer}, if any.
   *
   * @internal
   * @returns `void` if successful.
   * @returns {@link core!SDKError | SDKError} if no Viewer is attached.
   */
  detachViewer(): SDKError | void;
}
