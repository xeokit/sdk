import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {PickParams, PickResult, View} from "../../../viewer";
import type {WebGPUSnapManager} from "../snapManager";

/**
 * Owns WebGPU renderer-backed picking.
 *
 * The manager exists now to mirror the WebGL decomposition. The actual WebGPU
 * picking render/readback path is intentionally deferred.
 *
 * @internal
 */
export class WebGPUPickManager {

  private readonly _snapManager: WebGPUSnapManager;

  constructor(params: {
    snapManager: WebGPUSnapManager;
  }) {
    this._snapManager = params.snapManager;
  }

  public pick(view: View, pickParams: PickParams): SDKResult<PickResult> {
    void view;
    void pickParams;
    void this._snapManager;

    return {
      ok: false,
      type: SDKErrorType.NotSupported,
      error: "[WebGPUPickManager.pick] WebGPU picking is not implemented yet."
    };
  }

  public destroy(): void {
    // Hook for future pick buffers/resources.
  }
}
