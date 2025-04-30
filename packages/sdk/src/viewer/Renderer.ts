import type { Capabilities } from "../core";
import { PickParams } from "./PickParams";
import { PickResult } from "./PickResult";
import type { RendererObject } from "../scene";
import type { SceneModel } from "../scene";
import type { SDKError } from "../core";
import type { View } from "./View";
import type { Viewer } from "./Viewer";

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
     * Checks if Screen Space Ambient Occlusion (SAO) is supported by this Renderer.
     *
     * @internal
     * @returns `boolean` indicating SAO support.
     */
  getSAOSupported(): boolean;

  /**
     * The Viewer instance currently attached to this Renderer.
     * @internal
     */
  get viewer(): Viewer;

  /**
     * Collection of renderer objects that control visibility, highlighting, selection,
     * X-ray effects, and color adjustments for {@link scene!SceneObject | SceneObjects}
     * within this Renderer.
     * @internal
     */
  rendererObjects: { [key: string]: RendererObject };

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

  /**
     * Attaches a {@link View} to this Renderer.
     *
     * This enables rendering of all previously or subsequently created
     * {@link scene!SceneModel | SceneModels} for the new View.
     *
     * @internal
     * @param view The View to attach.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No Viewer is attached.
     * - Too many Views are attached.
     * - Renderer initialization for the View fails.
     */
  attachView(view: View): SDKError | void;

  /**
     * Detaches the specified {@link View} from this Renderer.
     *
     * Rendering for this View will cease.
     *
     * @internal
     * @param view The View to detach.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No Viewer is attached.
     * - The View is not currently attached.
     */
  detachView(view: View): SDKError | void;

  /**
     * Attaches a {@link scene!SceneModel | SceneModel} to this Renderer.
     *
     * This method establishes rendering hooks for the SceneModel’s elements,
     * allowing real-time state updates.
     *
     * @internal
     * @param sceneModel The SceneModel to attach.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View is attached.
     * - The SceneModel is already attached to this or another Renderer.
     */
  attachSceneModel(sceneModel: SceneModel): void | SDKError;

  /**
     * Detaches the specified {@link scene!SceneModel | SceneModel} from this Renderer.
     *
     * Cleans up associated rendering resources.
     *
     * @internal
     * @param sceneModel The SceneModel to detach.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View is attached.
     * - The SceneModel is not attached to this Renderer.
     */
  detachSceneModel(sceneModel: SceneModel): void | SDKError;

  /**
     * Toggles the rendering of transparent objects for a specified View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @param enabled Determines whether transparency is enabled.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  setTransparentEnabled(viewIndex: number, enabled: boolean): void | SDKError;

  /**
     * Enables or disables edge enhancement for the specified attached View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @param enabled Whether to enable edge enhancement.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  setEdgesEnabled(viewIndex: number, enabled: boolean): void | SDKError;

  /**
     * Enables or disables Screen Space Ambient Occlusion (SAO) for the specified attached View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @param enabled Whether to enable SAO.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  setSAOEnabled(viewIndex: number, enabled: boolean): void | SDKError;

  /**
     * Enables or disables Physically-Based Rendering (PBR) for the specified attached View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @param enabled Whether to enable PBR.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  setPBREnabled(viewIndex: number, enabled: boolean): void | SDKError;

  /**
     * Requests a new frame to be rendered for the given View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  setImageDirty(viewIndex?: number): void | SDKError;

  /**
     * Clears the Renderer for the specified View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  clear(viewIndex: number): void | SDKError;

  /**
     * Triggers a shader rebuild for the specified View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  setNeedsRebuild(viewIndex: number): void | SDKError;

  /**
     * Checks if a new frame needs to be rendered for the specified attached View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @returns `boolean` indicating if rendering is required.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  getNeedsRender(viewIndex: number): SDKError | boolean;

  /**
     * Renders a frame for the specified View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @param params Rendering parameters.
     * @returns `void` if successful.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  render(viewIndex: number, params: { force?: boolean, opaqueOnly?: boolean }): void | SDKError;

  /**
     * Performs object picking within a View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @param pickParams Picking parameters.
     * @param pickResult Optional pre-allocated PickResult.
     * @returns A {@link PickResult} or if object successfully picked.
     * @returns null if nothing picked.
     * @returns {@link core!SDKError | SDKError} if:
     * - No View with the given index is attached.
     */
  pick(viewIndex: number, pickParams: PickParams, pickResult?: PickResult): PickResult | null | SDKError;

  /**
     * Begins snapshot mode for the given View.
     *
     * @internal
     * @param viewIndex The View index. This matches {@link viewer!View.viewIndex | View.viewIndex} on a View that is currently attached to this Renderer.
     * @param params Snapshot configuration.
     */
  beginSnapshot(viewIndex: number, params?: { width: number, height: number });

  /**
     * Renders a snapshot frame of the current scene state.
     * @internal
     */
  renderSnapshot();

  /**
     * Retrieves an image of the snapshot canvas as a data URI.
     *
     * @internal
     * @returns The image data URI.
     */
  readSnapshot(params): string;

  /**
     * Returns an HTMLCanvasElement containing a snapshot image.
     *
     * @returns {HTMLCanvasElement} The snapshot canvas.
     */
  readSnapshotAsCanvas(params): HTMLCanvasElement;

  /**
     * Ends snapshot mode and restores normal rendering.
     */
  endSnapshot();
}
