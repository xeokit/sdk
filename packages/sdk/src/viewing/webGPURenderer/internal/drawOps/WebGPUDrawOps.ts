import {TrianglesPrimitive} from "../../../../base/constants";
import type {SDKResult} from "../../../../base/core";
import {RENDER_PASSES} from "../RENDER_PASSES";
import type {WebGPUPipelineManager} from "../WebGPUPipelineManager";
import {WebGPUDrawOp} from "./WebGPUDrawOp";
import type {RenderPassDrawOps} from "./RenderPassDrawOps";
import {WebGPUDrawTechnique} from "./WebGPUDrawTechnique";
import {WebGPUTrianglesDrawColorTechnique} from "./techniques";

/**
 * Owns WebGPU draw techniques and exposes primitive/render-pass draw ops.
 *
 * This is the WebGPU counterpart to WebGL DrawOps. It is intentionally small
 * for now because the WebGPU backend only has a single triangle color path.
 *
 * @internal
 */
export class WebGPUDrawOps {

  public prims: {
    [TrianglesPrimitive]?: RenderPassDrawOps;
  } = {};

  private readonly _pipelineManager: WebGPUPipelineManager;
  private _techniques: WebGPUDrawTechnique[] = [];

  constructor(pipelineManager: WebGPUPipelineManager) {
    this._pipelineManager = pipelineManager;
  }

  public init(): SDKResult<void> {
    this.destroy();

    const trianglesDrawColor = this._saveForCleanup(
      new WebGPUTrianglesDrawColorTechnique(this._pipelineManager)
    );

    this.prims[TrianglesPrimitive] = {
      opaque: new WebGPUDrawOp(trianglesDrawColor, RENDER_PASSES.OPAQUE),
      transparent: new WebGPUDrawOp(trianglesDrawColor, RENDER_PASSES.TRANSPARENT)
    };

    return {
      ok: true,
      value: undefined
    };
  }

  public destroy(): void {
    for (const technique of this._techniques) {
      technique.destroy();
    }
    this._techniques = [];
    this.prims = {};
  }

  private _saveForCleanup<T extends WebGPUDrawTechnique>(technique: T): T {
    this._techniques.push(technique);
    return technique;
  }
}
