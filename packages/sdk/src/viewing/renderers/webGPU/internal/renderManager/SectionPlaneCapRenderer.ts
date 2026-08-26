import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import type {Mat4} from "../../../../../base/math/matrix";
import type {View} from "../../../../viewer";
import type {WebGPUBindGroupLike, WebGPURenderPassEncoderLike} from "../../core";
import {CommandStateTracker, type InstancedDrawBatch, type RenderPassDrawOps} from "../drawOps";
import {TrianglesSectionPlaneCapTechnique, TrianglesStencilMaskTechnique} from "../drawOps/techniques";
import type {RenderInspector} from "../inspectors";
import type {WebGPUFrameAttachments} from "../webGPU";

export interface SectionPlaneCap {
  active: boolean;
  dir: ArrayLike<number>;
  dist: number;
  capColor?: ArrayLike<number> | null;
}

/**
 * Renders stencil-backed section-plane caps for triangle batches.
 *
 * @internal
 */
export class SectionPlaneCapRenderer {

  private readonly _renderInspector: RenderInspector;

  constructor(renderInspector: RenderInspector) {
    this._renderInspector = renderInspector;
  }

  public render(params: {
    commandEncoder: {beginRenderPass(descriptor: unknown): WebGPURenderPassEncoderLike};
    frameAttachments: WebGPUFrameAttachments;
    view: View;
    viewProjection: Mat4;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    batches: InstancedDrawBatch[];
    triangleDrawOps: RenderPassDrawOps;
    activePlanes: SectionPlaneCap[];
    viewportWidth: number;
    viewportHeight: number;
  }): SDKResult<void> {
    if (params.batches.length === 0 || params.activePlanes.length === 0) {
      return this._ok();
    }
    const stencilFrontOp = params.triangleDrawOps.stencilMaskFront;
    const stencilBackOp = params.triangleDrawOps.stencilMaskBack;
    const capOp = params.triangleDrawOps.sectionPlaneCaps;
    if (!stencilFrontOp || !stencilBackOp || !capOp) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[SectionPlaneCapRenderer.render] Section-plane cap draw operations were not initialized."
      };
    }
    const stencilTechnique = stencilFrontOp.technique as TrianglesStencilMaskTechnique;
    const capTechnique = capOp.technique as TrianglesSectionPlaneCapTechnique;

    for (let i = 0, len = params.activePlanes.length; i < len; i++) {
      const plane = params.activePlanes[i];
      if (!plane.capColor) {
        continue;
      }
      const capIndexResult = stencilTechnique.setCapPlaneIndex(i);
      if (capIndexResult.ok === false) {
        return capIndexResult;
      }
      const passEncoder = params.commandEncoder.beginRenderPass(params.frameAttachments.createSectionPlaneStencilMaskDescriptor());
      const commandStateTracker = new CommandStateTracker({
        passEncoder,
        commandStats: this._renderInspector
      });
      this._renderInspector.renderBinStarted("SECTION_PLANE_STENCIL_MASK");
      this._renderInspector.drawBatches({
        renderPass: "SECTION_PLANE_STENCIL_MASK",
        technique: "TrianglesStencilMaskTechnique",
        batches: params.batches
      });
      const frontResult = stencilFrontOp.drawBatches({
        passEncoder,
        commandStateTracker,
        frameBindGroup: params.frameBindGroup,
        instanceBindGroup: params.instanceBindGroup,
        batches: params.batches,
        commandStats: this._renderInspector
      });
      if (frontResult.ok === false) {
        return frontResult;
      }
      const backResult = stencilBackOp.drawBatches({
        passEncoder,
        commandStateTracker,
        frameBindGroup: params.frameBindGroup,
        instanceBindGroup: params.instanceBindGroup,
        batches: params.batches,
        commandStats: this._renderInspector
      });
      if (backResult.ok === false) {
        return backResult;
      }
      this._renderInspector.renderBinStarted("SECTION_PLANE_CAPS");
      const capResult = capTechnique.renderCapPlane({
        passEncoder,
        view: params.view,
        viewProjection: params.viewProjection,
        plane: {
          dir: plane.dir,
          dist: plane.dist,
          capColor: plane.capColor
        },
        otherPlanes: this._getOtherPlanes(params.activePlanes, i),
        viewportWidth: params.viewportWidth,
        viewportHeight: params.viewportHeight,
        commandStats: this._renderInspector,
        commandStateTracker
      });
      if (capResult.ok === false) {
        return capResult;
      }
      this._endRenderPass(passEncoder);
    }
    return this._ok();
  }

  private _getOtherPlanes(activePlanes: SectionPlaneCap[], capPlaneIndex: number): Array<{dir: ArrayLike<number>; dist: number}> {
    const otherPlanes: Array<{dir: ArrayLike<number>; dist: number}> = [];
    for (let i = 0, len = activePlanes.length; i < len; i++) {
      if (i !== capPlaneIndex) {
        otherPlanes.push({
          dir: activePlanes[i].dir,
          dist: activePlanes[i].dist
        });
      }
    }
    return otherPlanes;
  }

  private _endRenderPass(passEncoder: WebGPURenderPassEncoderLike): void {
    if (typeof passEncoder.end === "function") {
      passEncoder.end();
      return;
    }
    passEncoder.endPass?.();
  }

  private _ok(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }
}
