/**
 * Interface through which a {@link viewer!View | View} interacts with its {@link viewer!Renderer | Renderer}
 */
import {PickParams} from "./PickParams";
import {PickResult} from "./PickResult";

export interface RendererView {

  /**
   * Toggles the rendering of transparent objects for a specified View.
   *
    * @param enabled Determines whether transparency is enabled.
   */
  set transparencyEnabled(enabled: boolean): void;

  /**
   * Enables or disables edge enhancement for the specified attached View.
   *
   * @param enabled Whether to enable edge enhancement.
   */
  set edgesEnabled(enabled: boolean): void;

  /**
   * Enables or disables Screen Space Ambient Occlusion (SAO) for the specified attached View.
   *
   * @param enabled Whether to enable SAO.
   */
  set saoEnabled(enabled: boolean): void;

  /**
   * Enables or disables Physically-Based Rendering (PBR) for the specified attached View.
   *
   * @param enabled Whether to enable PBR.
   */
  set pbrEnabled(enabled: boolean): void;

  /**
   * Clears the Renderer for the specified View.
   *
   * @returns `void` if successful.
   * @returns {@link core!SDKError | SDKError} if:
   * - No View with the given tileIndex is attached.
   */
  clear(): void;

  /**
   * Flags that the View needs to be re-rendered.
   */
  needsRender(): void;

  /**
   * Renders a frame for the specified View, if a re-render is required.
   *
    * @param params Rendering parameters.
   */
  render(params: { force?: boolean, opaqueOnly?: boolean }): void;

  /**
   * Performs object picking within a View.
   *
   * @param pickParams Picking parameters.
   * @param pickResult Picking result.
   */
   pick(pickParams: PickParams, pickResult?: PickResult);

  /**
   * Begins snapshot mode for the given View.
   *
   * @internal
   * @param params Snapshot configuration.
   */
  beginSnapshot(params?: { width: number, height: number });
}
