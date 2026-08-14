import {TrianglesPrimitive} from "../../../../base/constants";
import type {SDKResult} from "../../../../base/core";
import {RENDER_PASSES} from "../RENDER_PASSES";
import type {BindGroupLayoutManager} from "../gpuMemoryManager";
import type {RenderContext} from "../RenderContext";
import {DrawOp} from "./DrawOp";
import type {RenderPassDrawOps} from "./RenderPassDrawOps";
import {DrawTechnique} from "./DrawTechnique";
import {
  TrianglesDepthPrepassTechnique,
  TrianglesDrawColorTechnique,
  TrianglesDrawEdgeColorTechnique,
  TrianglesPickTechnique,
  TrianglesSectionPlaneCapTechnique,
  TrianglesStencilMaskTechnique,
  TrianglesSnapEdgeTechnique,
  TrianglesSnapVertexTechnique
} from "./techniques";

/**
 * Owns WebGPU draw techniques and exposes primitive/render-pass draw ops.
 *
 * This is the WebGPU counterpart to WebGL DrawOps. It is intentionally small
 * for now because the WebGPU backend only has a single triangle color path.
 *
 * @internal
 */
export class DrawOps {

  public prims: {
    [TrianglesPrimitive]?: RenderPassDrawOps;
  } = {};

  private readonly _renderContext: RenderContext;
  private readonly _bindGroupLayoutManager: BindGroupLayoutManager;
  private _techniques: DrawTechnique[] = [];

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
  }) {
    this._renderContext = params.renderContext;
    this._bindGroupLayoutManager = params.bindGroupLayoutManager;
  }

  public init(): SDKResult<void> {
    this.destroy();

    const trianglesDrawColor = this._saveForCleanup(
      new TrianglesDrawColorTechnique({
        renderContext: this._renderContext,
        bindGroupLayoutManager: this._bindGroupLayoutManager
      })
    );
    const trianglesDepthPrepass = this._saveForCleanup(
      new TrianglesDepthPrepassTechnique({
        renderContext: this._renderContext,
        bindGroupLayoutManager: this._bindGroupLayoutManager
      })
    );
    const trianglesPick = this._saveForCleanup(
      new TrianglesPickTechnique({
        renderContext: this._renderContext,
        bindGroupLayoutManager: this._bindGroupLayoutManager
      })
    );
    const trianglesSnapVertex = this._saveForCleanup(
      new TrianglesSnapVertexTechnique({
        renderContext: this._renderContext,
        bindGroupLayoutManager: this._bindGroupLayoutManager
      })
    );
    const trianglesSnapEdge = this._saveForCleanup(
      new TrianglesSnapEdgeTechnique({
        renderContext: this._renderContext,
        bindGroupLayoutManager: this._bindGroupLayoutManager
      })
    );
    const trianglesDrawEdgeColor = this._saveForCleanup(
      new TrianglesDrawEdgeColorTechnique({
        renderContext: this._renderContext,
        bindGroupLayoutManager: this._bindGroupLayoutManager
      })
    );
    const trianglesSectionPlaneCap = this._saveForCleanup(
      new TrianglesSectionPlaneCapTechnique({
        renderContext: this._renderContext,
        bindGroupLayoutManager: this._bindGroupLayoutManager
      })
    );
    const trianglesStencilMask = this._saveForCleanup(
      new TrianglesStencilMaskTechnique({
        renderContext: this._renderContext,
        bindGroupLayoutManager: this._bindGroupLayoutManager
      })
    );

    this.prims[TrianglesPrimitive] = {
      depthPrepass: new DrawOp(trianglesDepthPrepass, RENDER_PASSES.DEPTH_PREPASS),
      opaque: new DrawOp(trianglesDrawColor, RENDER_PASSES.OPAQUE),
      transparent: new DrawOp(trianglesDrawColor, RENDER_PASSES.TRANSPARENT),
      edges: new DrawOp(trianglesDrawEdgeColor, RENDER_PASSES.OPAQUE),
      sectionPlaneCaps: new DrawOp(trianglesSectionPlaneCap, RENDER_PASSES.SECTION_PLANE_CAPS),
      stencilMaskFront: new DrawOp(trianglesStencilMask, RENDER_PASSES.STENCIL_MASK_FRONT),
      stencilMaskBack: new DrawOp(trianglesStencilMask, RENDER_PASSES.STENCIL_MASK_BACK),
      pick: new DrawOp(trianglesPick, RENDER_PASSES.PICK),
      snapVertex: new DrawOp(trianglesSnapVertex, RENDER_PASSES.PICK),
      snapEdge: new DrawOp(trianglesSnapEdge, RENDER_PASSES.PICK)
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

  private _saveForCleanup<T extends DrawTechnique>(technique: T): T {
    this._techniques.push(technique);
    return technique;
  }
}
