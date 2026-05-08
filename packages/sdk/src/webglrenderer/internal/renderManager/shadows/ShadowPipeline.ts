import type {RenderContext} from "../../RenderContext";
import type {ViewRenderState} from "../../ViewRenderState";
import type {DrawOps} from "../../drawOps/DrawOps";
import type {MeshBatch} from "../../meshManager/MeshBatch";
import type {View} from "../../../../viewer";

import {MAX_SHADOW_CASCADES} from "../../RenderContext";
import {PerspectiveProjectionType} from "../../../../constants";
import {lookAtMat4v, mulMat4, orthoMat4c} from "../../../../math/matrix";
import {getSceneAABB3Index} from "../../../../collision/aabb/SceneAABB3Index";
import {SDKErrorType, type SDKResult} from "../../../../core";


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

  // Slice distances including both ends: `[camNear, split0, split1, ..., camFar]`.
  // Length is `cascadeCount + 1`, reused and resized as needed.
  private readonly _sliceDistances = new Float32Array(MAX_SHADOW_CASCADES + 1);

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Hook for per-init setup. No external resources today — all FBOs are
   * lazily allocated through {@link ViewRenderState.renderBuffers}. Returns
   * {@link SDKResult} to mirror {@link SAOPipeline.init}.
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
  }): void {
    const {rendererView, drawOps, shadowBatches, comboBatches} = params;
    const view = rendererView.view;
    const rc = this._renderContext;
    const gl = rc.gl;
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
    this._computeCascadeSplits(camNear, camFar, cascadeCount, shadowsCfg.cascadeSplitLambda);

    // For each cascade: fit ortho to the slice, render depth, publish.
    for (let c = 0; c < cascadeCount; c++) {
      const sliceNear = this._sliceDistances[c];
      const sliceFar = this._sliceDistances[c + 1];

      this._buildLightVPForSlice(view, sliceNear, sliceFar, resolution, shadowsCfg.autoFit);

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
        depthTextureCompare: true,
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
      // Copy cascade 0's matrix so the shader's cascade-select math can't
      // pick up a stale zero matrix even if its logic misfires.
      const offset = c * 16;
      for (let i = 0; i < 16; i++) {
        rc.shadowLightViewProjMatrices[offset + i] = rc.shadowLightViewProjMatrices[i];
      }
    }

    rc.shadowCascadeCount = cascadeCount;
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

    // Rotate the world-space light direction into camera-view space (w = 0 so
    // only the rotation part of the view matrix is applied).
    const dxV = cameraViewMatrix[0] * dir[0] + cameraViewMatrix[4] * dir[1] + cameraViewMatrix[8]  * dir[2];
    const dyV = cameraViewMatrix[1] * dir[0] + cameraViewMatrix[5] * dir[1] + cameraViewMatrix[9]  * dir[2];
    const dzV = cameraViewMatrix[2] * dir[0] + cameraViewMatrix[6] * dir[1] + cameraViewMatrix[10] * dir[2];
    const dLen = Math.hypot(dxV, dyV, dzV) || 1.0;
    const dirViewX = dxV / dLen;
    const dirViewY = dyV / dLen;
    const dirViewZ = dzV / dLen;

    rc.shadowLightDirView[0] = dirViewX;
    rc.shadowLightDirView[1] = dirViewY;
    rc.shadowLightDirView[2] = dirViewZ;

    // Stable world-up rotated into view space.
    const worldUp: [number, number, number] = Math.abs(dir[2]) < 0.95 ? [0, 0, 1] : [0, 1, 0];
    const uxV = cameraViewMatrix[0] * worldUp[0] + cameraViewMatrix[4] * worldUp[1] + cameraViewMatrix[8]  * worldUp[2];
    const uyV = cameraViewMatrix[1] * worldUp[0] + cameraViewMatrix[5] * worldUp[1] + cameraViewMatrix[9]  * worldUp[2];
    const uzV = cameraViewMatrix[2] * worldUp[0] + cameraViewMatrix[6] * worldUp[1] + cameraViewMatrix[10] * worldUp[2];

    // Place the virtual light far behind the camera along -dirView. Exact
    // distance doesn't affect ortho projection — only orientation — so we
    // use a large fixed value in autoFit mode to keep caster z in front.
    const lightDistance = shadowsCfg.autoFit ? 1000.0 : shadowsCfg.lightDistance;
    const lightEyeView: [number, number, number] = [
      -dirViewX * lightDistance,
      -dirViewY * lightDistance,
      -dirViewZ * lightDistance
    ];
    const upView: [number, number, number] = [uxV, uyV, uzV];
    lookAtMat4v(lightEyeView, [0, 0, 0] as any, upView, this._lightView as any);
  }

  // ------------------------------------------------------------------
  // Cascade split math (PSSM).
  //
  // Stores distances (positive, view-space |z|) at indices 0..cascadeCount,
  // where index 0 = camNear and index cascadeCount = camFar. Entries
  // 1..cascadeCount-1 are the cascade boundaries.
  // ------------------------------------------------------------------
  private _computeCascadeSplits(near: number, far: number, count: number, lambda: number): void {
    this._sliceDistances[0] = near;
    for (let i = 1; i <= count; i++) {
      const p = i / count;
      const log = near * Math.pow(far / near, p);
      const uniform = near + (far - near) * p;
      this._sliceDistances[i] = lambda * log + (1.0 - lambda) * uniform;
    }
  }

  // ------------------------------------------------------------------
  // Per-cascade ortho-projection fit.
  //
  // Sizes the ortho bounds to tightly contain the camera frustum corners of
  // the slice `[sliceNear, sliceFar]` (and, when autoFit is on, intersects
  // with the scene's world AABB and snaps to world-space texels for
  // temporal stability). Writes the resulting lightVP to `_lightVP`.
  // ------------------------------------------------------------------
  private _buildLightVPForSlice(view: View, sliceNear: number, sliceFar: number, resolution: number, autoFit: boolean): void {
    const rc = this._renderContext;
    const gl = rc.gl;

    let left: number, right: number, bottom: number, top: number, near: number, far: number;
    if (autoFit) {
      const fit = this._fitOrthoToSlice(view, gl.drawingBufferWidth, gl.drawingBufferHeight, resolution, sliceNear, sliceFar);
      left = fit.left; right = fit.right; bottom = fit.bottom; top = fit.top; near = fit.near; far = fit.far;
    } else {
      const shadowsCfg = view.effects.shadows;
      const projSize = shadowsCfg.projectionSize;
      const lightDistance = shadowsCfg.lightDistance;
      left = -projSize; right = projSize; bottom = -projSize; top = projSize;
      near = 0.1;
      far = lightDistance * 3.0;
    }

    orthoMat4c(left, right, bottom, top, near, far, this._lightProj as any);
    mulMat4(this._lightProj as any, this._lightView as any, this._lightVP as any);
  }

  // ------------------------------------------------------------------
  // Auto-fit ortho to a specific slice of the camera frustum.
  //
  // Near/far distances of the slice are inputs (instead of hardcoding
  // 0.1 and maxDistance) so this same routine fits every cascade.
  // ------------------------------------------------------------------
  private _fitOrthoToSlice(
    view: View,
    drawingBufferWidth: number,
    drawingBufferHeight: number,
    resolution: number,
    sliceNear: number,
    sliceFar: number
  ): { left: number; right: number; bottom: number; top: number; near: number; far: number } {
    const shadowsCfg = view.effects.shadows;
    const camera = view.camera;
    const aspect = Math.max(1e-6, drawingBufferHeight > 0 ? drawingBufferWidth / drawingBufferHeight : 1);

    // Camera frustum half-extents at the slice's near and far planes.
    let halfNearH: number, halfNearW: number, halfFarH: number, halfFarW: number;
    if (camera.projectionType === PerspectiveProjectionType) {
      const fovRad = camera.perspectiveProjection.fov * Math.PI / 180.0;
      const tanHalfFov = Math.tan(fovRad * 0.5);
      if (aspect >= 1) {
        halfNearH = tanHalfFov * sliceNear;
        halfNearW = halfNearH * aspect;
        halfFarH  = tanHalfFov * sliceFar;
        halfFarW  = halfFarH * aspect;
      } else {
        halfNearW = tanHalfFov * sliceNear;
        halfNearH = halfNearW / aspect;
        halfFarW  = tanHalfFov * sliceFar;
        halfFarH  = halfFarW / aspect;
      }
    } else {
      const op = camera.orthoProjection;
      const halfH = op.scale * 0.5;
      halfNearH = halfFarH = halfH;
      halfNearW = halfFarW = halfH * aspect;
    }

    // 8 slice-frustum corners in camera-view space. Camera looks down -Z.
    const corners: [number, number, number][] = [
      [-halfNearW, -halfNearH, -sliceNear], [halfNearW, -halfNearH, -sliceNear],
      [-halfNearW,  halfNearH, -sliceNear], [halfNearW,  halfNearH, -sliceNear],
      [-halfFarW,  -halfFarH,  -sliceFar ], [halfFarW,  -halfFarH,  -sliceFar ],
      [-halfFarW,   halfFarH,  -sliceFar ], [halfFarW,   halfFarH,  -sliceFar ]
    ];

    // Project into light-view space and take the AABB.
    const m = this._lightView;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const c of corners) {
      const x = m[0] * c[0] + m[4] * c[1] + m[8]  * c[2] + m[12];
      const y = m[1] * c[0] + m[5] * c[1] + m[9]  * c[2] + m[13];
      const z = m[2] * c[0] + m[6] * c[1] + m[10] * c[2] + m[14];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    // Tight-fit against the scene AABB (RTC-precise via Float64 cameraView).
    const scene = this._renderContext.viewer.scene;
    if (scene) {
      const sceneAABB = getSceneAABB3Index(scene).getSceneAABB();
      if (isFiniteAABB(sceneAABB)) {
        const cv = view.camera.viewMatrix;
        let sMinX = Infinity, sMaxX = -Infinity;
        let sMinY = Infinity, sMaxY = -Infinity;
        let sMinZ = Infinity, sMaxZ = -Infinity;
        for (let cornerIdx = 0; cornerIdx < 8; cornerIdx++) {
          const wx = (cornerIdx & 1) ? sceneAABB[3] : sceneAABB[0];
          const wy = (cornerIdx & 2) ? sceneAABB[4] : sceneAABB[1];
          const wz = (cornerIdx & 4) ? sceneAABB[5] : sceneAABB[2];
          const vx = cv[0] * wx + cv[4] * wy + cv[8]  * wz + cv[12];
          const vy = cv[1] * wx + cv[5] * wy + cv[9]  * wz + cv[13];
          const vz = cv[2] * wx + cv[6] * wy + cv[10] * wz + cv[14];
          const lx = m[0] * vx + m[4] * vy + m[8]  * vz + m[12];
          const ly = m[1] * vx + m[5] * vy + m[9]  * vz + m[13];
          const lz = m[2] * vx + m[6] * vy + m[10] * vz + m[14];
          if (lx < sMinX) sMinX = lx; if (lx > sMaxX) sMaxX = lx;
          if (ly < sMinY) sMinY = ly; if (ly > sMaxY) sMaxY = ly;
          if (lz < sMinZ) sMinZ = lz; if (lz > sMaxZ) sMaxZ = lz;
        }
        const iMinX = Math.max(minX, sMinX), iMaxX = Math.min(maxX, sMaxX);
        const iMinY = Math.max(minY, sMinY), iMaxY = Math.min(maxY, sMaxY);
        const iMinZ = Math.max(minZ, sMinZ), iMaxZ = Math.min(maxZ, sMaxZ);
        if (iMinX < iMaxX && iMinY < iMaxY && iMinZ < iMaxZ) {
          minX = iMinX; maxX = iMaxX;
          minY = iMinY; maxY = iMaxY;
          minZ = iMinZ; maxZ = iMaxZ;
        }
      }
    }

    // Edge padding.
    const padMul = Math.max(1.0, shadowsCfg.padding);
    const padX = (maxX - minX) * (padMul - 1.0) * 0.5;
    const padY = (maxY - minY) * (padMul - 1.0) * 0.5;
    let left = minX - padX;
    let right = maxX + padX;
    let bottom = minY - padY;
    let top = maxY + padY;

    // World-space texel snap (anchors the grid to the world origin's
    // light-view position, stripping the integer-multiples part to stay
    // float-precision-safe even for UTM-scale camera eyes).
    const extentX = right - left;
    const extentY = top - bottom;
    const texelX = extentX / resolution;
    const texelY = extentY / resolution;
    if (texelX > 0 && texelY > 0) {
      const cv = view.camera.viewMatrix;
      const lv = this._lightView;
      const wvX = cv[12], wvY = cv[13], wvZ = cv[14];
      const originLVx = lv[0] * wvX + lv[4] * wvY + lv[8]  * wvZ + lv[12];
      const originLVy = lv[1] * wvX + lv[5] * wvY + lv[9]  * wvZ + lv[13];
      const modOffsetX = ((originLVx % texelX) + texelX) % texelX;
      const modOffsetY = ((originLVy % texelY) + texelY) % texelY;

      left = Math.floor((left - modOffsetX) / texelX) * texelX + modOffsetX;
      right = left + extentX;
      bottom = Math.floor((bottom - modOffsetY) / texelY) * texelY + modOffsetY;
      top = bottom + extentY;
    }

    // Ortho near/far measured as positive distances from the light along -z.
    // Pull the near plane further back by sliceFar so casters between the
    // light and the frustum still register.
    const near = Math.max(0.01, -maxZ);
    const far  = -minZ + sliceFar;

    return {left, right, bottom, top, near, far};
  }
}

function isFiniteAABB(aabb: ArrayLike<number>): boolean {
  return (
    aabb[0] <= aabb[3] &&
    aabb[1] <= aabb[4] &&
    aabb[2] <= aabb[5] &&
    Number.isFinite(aabb[0]) && Number.isFinite(aabb[3]) &&
    Number.isFinite(aabb[1]) && Number.isFinite(aabb[4]) &&
    Number.isFinite(aabb[2]) && Number.isFinite(aabb[5])
  );
}
