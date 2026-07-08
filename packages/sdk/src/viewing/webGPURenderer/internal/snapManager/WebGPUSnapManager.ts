import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {PickParams, PickResult, View} from "../../../viewer";

/**
 * Owns WebGPU snap-picking support.
 *
 * The class mirrors WebGL's SnapManager boundary while the WebGPU snap render
 * passes are still unimplemented.
 *
 * @internal
 */
export class WebGPUSnapManager {

  public snapPick(view: View, pickParams: PickParams): SDKResult<PickResult> {
    void view;
    void pickParams;

    return {
      ok: false,
      type: SDKErrorType.NotSupported,
      error: "[WebGPUSnapManager.snapPick] WebGPU snap picking is not implemented yet."
    };
  }

  public destroy(): void {
    // Hook for future snap buffers/resources.
  }
}
