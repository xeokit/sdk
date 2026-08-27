import type {RenderContext} from "../../RenderContext";
import type {ViewRenderState} from "../../ViewRenderState";
import type {DrawOps} from "../../drawOps/DrawOps";
import type {MeshBatch} from "../../meshManager/MeshBatch";
import type {View} from "../../../../../viewer";

import {MAX_SHADOW_CASCADES} from "../../RenderContext";
import {PerspectiveProjectionType} from "../../../../../../base/constants";
import {inverseMat4, lookAtMat4v, mulMat4, orthoMat4c, type Mat4} from "../../../../../../base/math/matrix";
import {
  computeShadowCascadeSplits,
  fitShadowCascadeToCamera,
  isFiniteShadowAABB,
  type ShadowCascadeCameraProjection
} from "../../../../../../base/math/shadows";
import {getSceneCollisionIndex} from "../../../../../../spatial/collision";
import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import {getShadowDebugModeId} from "../../../../../viewer/ShadowSampling";


/**
 * Renders Cascaded Shadow Maps (CSM) for a directional light.
 *
 * The camera's view-space depth range (`[near, maxDistance]`) is split into
 * `view.effects.shadows.cascadeCount` slices using PSSM (Lambda-weighted mix of
 * uniform and logarithmic splits). Each slice gets its own shadow map whose
 * ortho frustum is auto-fit tightly to that slice's frustum corners — so
 * near slices concentrate shadow-map texels on nearby geometry, and far
 * slices cover the rest of the visible range with coarser resolution.
 *
 * Per frame:
 *   1. Compute the light view matrix and the `N-1` split boundaries.
 *   2. For each cascade `c`:
 *      - Fit an ortho frustum to the slice's camera frustum corners.
 *      - Render caster depth into cascade `c`'s FBO.
 *      - Publish the cascade's light-VP matrix and depth texture on
 *        {@link RenderContext}.
 *   3. Alias unused cascade slots to cascade 0 so every shader sampler has
 *      a valid binding even when `cascadeCount < MAX_SHADOW_CASCADES`.
 *
 * `cascadeCount = 1` produces the same output as the pre-CSM pipeline: one
 * cascade fit to the full `[near, maxDistance]` range.
 *
 * @internal
 */
export class ShadowPipeline {

  private readonly _renderContext: RenderContext;

  // Scratch matrices reused per cascade so steady-state has no allocation.
  private readonly _lightView = new Float64Array(16);
  private readonly _lightProj = new Float64Array(16);
  private readonly _lightVP = new Float64Array(16);
  private readonly _worldLightVP = new Float64Array(16);
  private readonly _inverseCameraView = new Float64Array(16);

  // Slice distances including both ends: `[camNear, split0, split1, ..., camFar]`.
  // Length is `cascadeCount + 1`, reused and resized as needed.
  private readonly _sliceDistances = new Float32Array(MAX_SHADOW_CASCADES + 1);

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Hook for per-init setup. No external resources today — all FBOs are
   * lazily allocated through {@link ViewRenderState.renderBuffers}. Returns
   * {@link base!core.SDKResult | SDKResult} to mirror {@link SAOPipeline.init}.
   */
  init(): SDKResult<void> {
    return {ok: true, value: undefined};
  }

  /**
   * Runs all cascade depth passes and publishes cascade state on
   * {@link RenderContext}. Callers restore the main framebuffer before
   * drawing shadowed color.
   */
  render(params: {
    rendererView: ViewRenderState;
    drawOps: DrawOps["prims"];
    shadowBatches: MeshBatch[];
    comboBatches: MeshBatch[];
    transparentShadowBatches?: MeshBatch[];
  }): void {
    const {rendererView, drawOps, shadowBatches, comboBatches} = params;
    const transparentShadowBatches = params.transparentShadowBatches ?? [];
    const view = rendererView.view;
    const rc = this._renderContext;
    const gl = rc.gl;

    // Start of a batch-draw run (the shadow depth passes) — clear the per-unit
    // bound-texture tracking so the redundant-bind skip starts from a known
    // state.
    rc.resetTextureBindings();

    const shadowsCfg = view.effects.shadows;
    const resolution = shadowsCfg.resolution;
    const cascadeCount = Math.min(MAX_SHADOW_CASCADES, Math.max(1, shadowsCfg.cascadeCount));

    // Once per frame: the light view matrix (rotation-only, same for every
    // cascade) and the corresponding view-space light direction.
    this._computeLightView(view);

    // Slice the view-space depth range into cascades.
    const camNear = 0.1;
    const camFar = Math.min(
      shadowsCfg.maxDistance,
      view.camera.projectionType === PerspectiveProjectionType
        ? view.camera.perspectiveProjection.far
        : view.camera.orthoProjection.far
    );
    computeShadowCascadeSplits({
      nearDistance: camNear,
      farDistance: camFar,
      cascadeCount,
      lambda: shadowsCfg.cascadeSplitLambda,
      target: this._sliceDistances
    });

    // For each cascade: fit ortho to the slice, render depth, publish.
    for (let c = 0; c < cascadeCount; c++) {
      const sliceNear = this._sliceDistances[c];
      const sliceFar = this._sliceDistances[c + 1];

      const fitMetrics = this._buildLightVPForSlice(view, sliceNear, sliceFar, resolution, shadowsCfg.autoFit);
      rc.shadowCascadeDepthRanges[c] = fitMetrics.depthRange;
      rc.shadowCascadeTexelSizes[c] = fitMetrics.texelWorldSize;

      // Matrix goes into the plural array (for the color pass) AND the
      // singular slot (for this cascade's upcoming depth pass).
      const offset = c * 16;
      for (let i = 0; i < 16; i++) {
        rc.shadowLightViewProjMatrices[offset + i] = this._lightVP[i];
        rc.shadowLightViewProjMatrix[i] = this._lightVP[i];
      }

      // Per-cascade depth FBO. Distinct renderBuffer IDs so each cascade
      // gets its own cached WebGLRenderBuffer at the chosen resolution.
      const shadowBuffer = rendererView.renderBuffers.getRenderBuffer(`shadowMap_c${c}`, {
        depthTexture: true,
        depthTextureCompare: false,
        size: [resolution, resolution]
      });

      shadowBuffer.bind();
      gl.viewport(0, 0, resolution, resolution);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      rc.lastProgramId = -1;
      for (let i = 0; i < shadowBatches.length; i++) {
        drawOps[shadowBatches[i].primitive]?.shadowDepth?.drawBatch(shadowBatches[i]);
      }
      for (let i = 0; i < comboBatches.length; i++) {
        drawOps[comboBatches[i].primitive]?.shadowDepth?.drawBatch(comboBatches[i]);
      }
      for (let i = 0; i < transparentShadowBatches.length; i++) {
        const drawOpsForPrimitive = drawOps[transparentShadowBatches[i].primitive];
        (drawOpsForPrimitive?.shadowDepthTransparent ?? drawOpsForPrimitive?.shadowDepth)?.drawBatch(transparentShadowBatches[i]);
      }
      shadowBuffer.unbind();

      rc.shadowMapTextures[c] = shadowBuffer.getDepthTexture();
    }

    // Boundary distances exposed to the color shader: far edge of cascade c
    // is the near edge of cascade c+1. Only `cascadeCount - 1` values carry
    // meaning, but always write 4 so out-of-range comparisons are defined.
    for (let c = 0; c < MAX_SHADOW_CASCADES; c++) {
      rc.shadowCascadeSplits[c] =
        c < cascadeCount - 1 ? this._sliceDistances[c + 1] : Number.MAX_VALUE;
    }

    // Alias unused cascade slots to cascade 0 so every sampler in the color
    // shader has a valid texture binding, even when cascadeCount < MAX.
    const cascade0Tex = rc.shadowMapTextures[0];
    for (let c = cascadeCount; c < MAX_SHADOW_CASCADES; c++) {
      rc.shadowMapTextures[c] = cascade0Tex;
      rc.shadowCascadeDepthRanges[c] = rc.shadowCascadeDepthRanges[0] || 1;
      rc.shadowCascadeTexelSizes[c] = rc.shadowCascadeTexelSizes[0] || 1;
      // Copy cascade 0's matrix so the shader's cascade-select math can't
      // pick up a stale zero matrix even if its logic misfires.
      const offset = c * 16;
      for (let i = 0; i < 16; i++) {
        rc.shadowLightViewProjMatrices[offset + i] = rc.shadowLightViewProjMatrices[i];
      }
    }

    rc.shadowCascadeCount = cascadeCount;
    const lightRadius = Number.isFinite(Number(shadowsCfg.lightRadius)) ? Number(shadowsCfg.lightRadius) : 0.08;
    rc.shadowSoftParams[0] = shadowsCfg.contactHardening ? 1 : 0;
    rc.shadowSoftParams[1] = Math.max(0, lightRadius);
    rc.shadowSoftParams[2] = 1;
    rc.shadowSoftParams[3] = getShadowDebugModeId(shadowsCfg.debug);
  }

  destroy(): void {
    // Scratch matrices GC with the instance; cascade FBOs live in the
    // shared RenderBuffers cache.
  }

  // ------------------------------------------------------------------
  // Light view matrix (shared across cascades).
  // ------------------------------------------------------------------
  private _computeLightView(view: View): void {
    const rc = this._renderContext;
    const shadowsCfg = view.effects.shadows;
    const cameraViewMatrix = view.camera.viewMatrix;
    const dir = shadowsCfg.direction;
    const direction = normalize3(dir[0], dir[1], dir[2]);

    // Rotate the world-space light direction into camera-view space (w = 0 so
    // only the rotation part of the view matrix is applied).
    const dxV = cameraViewMatrix[0] * direction[0] + cameraViewMatrix[4] * direction[1] + cameraViewMatrix[8]  * direction[2];
    const dyV = cameraViewMatrix[1] * direction[0] + cameraViewMatrix[5] * direction[1] + cameraViewMatrix[9]  * direction[2];
    const dzV = cameraViewMatrix[2] * direction[0] + cameraViewMatrix[6] * direction[1] + cameraViewMatrix[10] * direction[2];
    const dLen = Math.hypot(dxV, dyV, dzV) || 1.0;
    const dirViewX = dxV / dLen;
    const dirViewY = dyV / dLen;
    const dirViewZ = dzV / dLen;

    rc.shadowLightDirView[0] = dirViewX;
    rc.shadowLightDirView[1] = dirViewY;
    rc.shadowLightDirView[2] = dirViewZ;

    // Place the virtual light far behind the scene along -dir. Exact
    // distance doesn't affect ortho projection — only orientation — so we
    // use a large fixed value in autoFit mode to keep caster z in front.
    const worldUp: [number, number, number] = Math.abs(direction[2]) < 0.95 ? [0, 0, 1] : [0, 1, 0];
    const lightDistance = shadowsCfg.autoFit ? 1000.0 : shadowsCfg.lightDistance;
    const lightEyeWorld: [number, number, number] = [
      -direction[0] * lightDistance,
      -direction[1] * lightDistance,
      -direction[2] * lightDistance
    ];
    lookAtMat4v(lightEyeWorld, [0, 0, 0] as any, worldUp, this._lightView as any);
  }

  // ------------------------------------------------------------------
  // Per-cascade ortho-projection fit.
  //
  // Sizes the ortho bounds to tightly contain the camera frustum corners of
  // the slice `[sliceNear, sliceFar]` (and, when autoFit is on, intersects
  // with the scene's world AABB and snaps to world-space texels for
  // temporal stability). Writes the resulting view-space lightVP to `_lightVP`.
  // ------------------------------------------------------------------
  private _buildLightVPForSlice(view: View, sliceNear: number, sliceFar: number, resolution: number, autoFit: boolean): {depthRange: number; texelWorldSize: number} {
    const rc = this._renderContext;
    const gl = rc.gl;
    const camera = view.camera;
    const inverseCameraViewMatrix = (camera as {inverseViewMatrix?: ArrayLike<number>}).inverseViewMatrix
      ?? inverseMat4(camera.viewMatrix as Mat4, this._inverseCameraView as Mat4);

    let left: number, right: number, bottom: number, top: number, near: number, far: number;
    let depthRange: number;
    let texelWorldSize: number;
    if (autoFit) {
      const fit = fitShadowCascadeToCamera({
        projection: getShadowCameraProjection(view),
        canvasWidth: gl.drawingBufferWidth,
        canvasHeight: gl.drawingBufferHeight,
        nearDistance: sliceNear,
        farDistance: sliceFar,
        lightViewMatrix: this._lightView as Mat4,
        cameraInverseViewMatrix: inverseCameraViewMatrix,
        resolution,
        padding: view.effects.shadows.padding,
        sceneAABB: getSceneAABB(this._renderContext.viewer.scene)
      });
      left = fit.left; right = fit.right; bottom = fit.bottom; top = fit.top; near = fit.near; far = fit.far;
      depthRange = fit.depthRange;
      texelWorldSize = fit.texelWorldSize;
    } else {
      const shadowsCfg = view.effects.shadows;
      const projSize = shadowsCfg.projectionSize;
      const lightDistance = shadowsCfg.lightDistance;
      left = -projSize; right = projSize; bottom = -projSize; top = projSize;
      near = 0.1;
      far = lightDistance * 3.0;
      depthRange = Math.max(0.001, far - near);
      texelWorldSize = Math.max(0.000001, Math.max(right - left, top - bottom) / Math.max(1, resolution));
    }

    orthoMat4c(left, right, bottom, top, near, far, this._lightProj as any);
    mulMat4(this._lightProj as any, this._lightView as any, this._worldLightVP as any);
    mulMat4(this._worldLightVP as any, inverseCameraViewMatrix as Mat4, this._lightVP as any);
    return {
      depthRange,
      texelWorldSize
    };
  }
}

function getShadowCameraProjection(view: View): ShadowCascadeCameraProjection {
  return view.camera.projectionType === PerspectiveProjectionType
    ? {
      type: "perspective",
      fovDegrees: view.camera.perspectiveProjection.fov
    }
    : {
      type: "ortho",
      scale: view.camera.orthoProjection.scale
    };
}

function getSceneAABB(scene: unknown): ArrayLike<number> | null {
  if (!scene || !canUseSceneCollisionIndex(scene)) {
    return null;
  }
  const sceneAABB = getSceneCollisionIndex(scene as any).getSceneAABB();
  return sceneAABB && isFiniteShadowAABB(sceneAABB) ? sceneAABB : null;
}

function canUseSceneCollisionIndex(scene: unknown): boolean {
  const sceneLike = scene as {id?: unknown; events?: {onSceneDestroyed?: {subscribe?: unknown}}};
  return (
    typeof sceneLike.id === "string" &&
    typeof sceneLike.events?.onSceneDestroyed?.subscribe === "function"
  );
}

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z);
  if (len <= 1e-12) {
    return [0, 0, -1];
  }
  return [x / len, y / len, z / len];
}
