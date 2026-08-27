import type {Mat4} from "./matrix";

/**
 * Camera projection parameters needed by shadow cascade fitting.
 *
 * @internal
 */
export type ShadowCascadeCameraProjection =
  | {
  type: "perspective";
  fovDegrees: number;
}
  | {
  type: "ortho";
  scale: number;
};

/**
 * Stable orthographic bounds for one shadow cascade.
 *
 * @internal
 */
export type ShadowCascadeOrthoBounds = {
  left: number;
  right: number;
  bottom: number;
  top: number;
  near: number;
  far: number;
  depthRange: number;
  texelWorldSize: number;
};

/**
 * Computes PSSM cascade slice distances.
 *
 * The returned values include both endpoints: index 0 is the near distance,
 * index `cascadeCount` is the far distance, and intermediate entries are the
 * split boundaries.
 *
 * @internal
 */
export function computeShadowCascadeSplits(params: {
  nearDistance: number;
  farDistance: number;
  cascadeCount: number;
  lambda: number;
  target?: Float32Array | Float64Array | number[];
}): Float32Array | Float64Array | number[] {
  const count = Math.max(1, Math.floor(params.cascadeCount));
  const near = Math.max(0.000001, params.nearDistance);
  const far = Math.max(near + 0.000001, params.farDistance);
  const lambda = clamp01(params.lambda);
  const target = params.target ?? new Float32Array(count + 1);
  target[0] = near;
  for (let i = 1; i <= count; i++) {
    const p = i / count;
    const log = near * Math.pow(far / near, p);
    const uniform = near + (far - near) * p;
    target[i] = lambda * log + (1 - lambda) * uniform;
  }
  return target;
}

/**
 * Snaps fitted shadow projection bounds to a stable texel grid.
 *
 * Uses a square extent so shadow-map texels have one world-space scale, adds
 * a one-texel guard on each side so center snapping cannot clip fitted
 * content, then snaps the projection center to the anchor-aligned grid.
 *
 * @internal
 */
export function stabilizeShadowOrthoBounds(params: {
  left: number;
  right: number;
  bottom: number;
  top: number;
  resolution: number;
  anchorX?: number;
  anchorY?: number;
}): {
  left: number;
  right: number;
  bottom: number;
  top: number;
  texelWorldSize: number;
} {
  const resolution = Math.max(1, Math.floor(params.resolution));
  const extentX = params.right - params.left;
  const extentY = params.top - params.bottom;
  const fallbackTexelWorldSize = Math.max(0.000001, Math.max(extentX, extentY) / resolution);
  if (
    !Number.isFinite(extentX) || !Number.isFinite(extentY) ||
    extentX <= 0 || extentY <= 0
  ) {
    return {
      left: params.left,
      right: params.right,
      bottom: params.bottom,
      top: params.top,
      texelWorldSize: fallbackTexelWorldSize
    };
  }

  const stableExtent = Math.max(extentX, extentY) * (1 + 2 / resolution);
  const texelWorldSize = Math.max(0.000001, stableExtent / resolution);
  const centerX = (params.left + params.right) * 0.5;
  const centerY = (params.bottom + params.top) * 0.5;
  const anchorX = Number.isFinite(params.anchorX) ? Number(params.anchorX) : 0;
  const anchorY = Number.isFinite(params.anchorY) ? Number(params.anchorY) : 0;
  const snappedCenterX = Math.round((centerX - anchorX) / texelWorldSize) * texelWorldSize + anchorX;
  const snappedCenterY = Math.round((centerY - anchorY) / texelWorldSize) * texelWorldSize + anchorY;
  const halfExtent = stableExtent * 0.5;
  return {
    left: snappedCenterX - halfExtent,
    right: snappedCenterX + halfExtent,
    bottom: snappedCenterY - halfExtent,
    top: snappedCenterY + halfExtent,
    texelWorldSize
  };
}

/**
 * Fits one directional-light shadow cascade to a camera frustum slice.
 *
 * The camera inverse-view matrix maps camera-view coordinates into world
 * coordinates. The light-view matrix maps world coordinates into light-view
 * coordinates. The optional scene AABB is also in world coordinates.
 *
 * @internal
 */
export function fitShadowCascadeToCamera(params: {
  projection: ShadowCascadeCameraProjection;
  canvasWidth: number;
  canvasHeight: number;
  nearDistance: number;
  farDistance: number;
  lightViewMatrix: Mat4 | ArrayLike<number>;
  cameraInverseViewMatrix: Mat4 | ArrayLike<number>;
  resolution: number;
  padding: number;
  sceneAABB?: ArrayLike<number> | null;
  anchorX?: number;
  anchorY?: number;
}): ShadowCascadeOrthoBounds {
  const aspect = Math.max(1e-6, params.canvasHeight > 0 ? params.canvasWidth / params.canvasHeight : 1);
  const nearDistance = Math.max(0.000001, params.nearDistance);
  const farDistance = Math.max(nearDistance + 0.000001, params.farDistance);
  const {halfNearW, halfNearH, halfFarW, halfFarH} = getFrustumHalfExtents(
    params.projection,
    aspect,
    nearDistance,
    farDistance
  );

  const corners = [
    [-halfNearW, -halfNearH, -nearDistance],
    [halfNearW, -halfNearH, -nearDistance],
    [-halfNearW, halfNearH, -nearDistance],
    [halfNearW, halfNearH, -nearDistance],
    [-halfFarW, -halfFarH, -farDistance],
    [halfFarW, -halfFarH, -farDistance],
    [-halfFarW, halfFarH, -farDistance],
    [halfFarW, halfFarH, -farDistance]
  ];
  const lightView = params.lightViewMatrix;
  const inverseView = params.cameraInverseViewMatrix;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const corner of corners) {
    const wx = inverseView[0] * corner[0] + inverseView[4] * corner[1] + inverseView[8] * corner[2] + inverseView[12];
    const wy = inverseView[1] * corner[0] + inverseView[5] * corner[1] + inverseView[9] * corner[2] + inverseView[13];
    const wz = inverseView[2] * corner[0] + inverseView[6] * corner[1] + inverseView[10] * corner[2] + inverseView[14];
    const lx = lightView[0] * wx + lightView[4] * wy + lightView[8] * wz + lightView[12];
    const ly = lightView[1] * wx + lightView[5] * wy + lightView[9] * wz + lightView[13];
    const lz = lightView[2] * wx + lightView[6] * wy + lightView[10] * wz + lightView[14];
    minX = Math.min(minX, lx);
    maxX = Math.max(maxX, lx);
    minY = Math.min(minY, ly);
    maxY = Math.max(maxY, ly);
    minZ = Math.min(minZ, lz);
    maxZ = Math.max(maxZ, lz);
  }

  const sceneAABB = params.sceneAABB;
  if (sceneAABB && isFiniteShadowAABB(sceneAABB)) {
    let sceneMinX = Infinity;
    let sceneMaxX = -Infinity;
    let sceneMinY = Infinity;
    let sceneMaxY = -Infinity;
    let sceneMinZ = Infinity;
    let sceneMaxZ = -Infinity;
    for (let cornerIdx = 0; cornerIdx < 8; cornerIdx++) {
      const wx = (cornerIdx & 1) ? sceneAABB[3] : sceneAABB[0];
      const wy = (cornerIdx & 2) ? sceneAABB[4] : sceneAABB[1];
      const wz = (cornerIdx & 4) ? sceneAABB[5] : sceneAABB[2];
      const lx = lightView[0] * wx + lightView[4] * wy + lightView[8] * wz + lightView[12];
      const ly = lightView[1] * wx + lightView[5] * wy + lightView[9] * wz + lightView[13];
      const lz = lightView[2] * wx + lightView[6] * wy + lightView[10] * wz + lightView[14];
      sceneMinX = Math.min(sceneMinX, lx);
      sceneMaxX = Math.max(sceneMaxX, lx);
      sceneMinY = Math.min(sceneMinY, ly);
      sceneMaxY = Math.max(sceneMaxY, ly);
      sceneMinZ = Math.min(sceneMinZ, lz);
      sceneMaxZ = Math.max(sceneMaxZ, lz);
    }
    const intersectMinX = Math.max(minX, sceneMinX);
    const intersectMaxX = Math.min(maxX, sceneMaxX);
    const intersectMinY = Math.max(minY, sceneMinY);
    const intersectMaxY = Math.min(maxY, sceneMaxY);
    const intersectMinZ = Math.max(minZ, sceneMinZ);
    const intersectMaxZ = Math.min(maxZ, sceneMaxZ);
    if (intersectMinX < intersectMaxX && intersectMinY < intersectMaxY && intersectMinZ < intersectMaxZ) {
      minX = intersectMinX;
      maxX = intersectMaxX;
      minY = intersectMinY;
      maxY = intersectMaxY;
      minZ = intersectMinZ;
      maxZ = intersectMaxZ;
    }
  }

  const padMul = Math.max(1, params.padding);
  const padX = (maxX - minX) * (padMul - 1) * 0.5;
  const padY = (maxY - minY) * (padMul - 1) * 0.5;
  const stableBounds = stabilizeShadowOrthoBounds({
    left: minX - padX,
    right: maxX + padX,
    bottom: minY - padY,
    top: maxY + padY,
    resolution: params.resolution,
    anchorX: params.anchorX ?? lightView[12],
    anchorY: params.anchorY ?? lightView[13]
  });
  const near = Math.max(0.01, -maxZ);
  const far = -minZ + farDistance;
  return {
    left: stableBounds.left,
    right: stableBounds.right,
    bottom: stableBounds.bottom,
    top: stableBounds.top,
    near,
    far,
    depthRange: Math.max(0.001, far - near),
    texelWorldSize: stableBounds.texelWorldSize
  };
}

/**
 * Tests whether an AABB has ordered, finite bounds.
 *
 * @internal
 */
export function isFiniteShadowAABB(aabb: ArrayLike<number>): boolean {
  return (
    aabb[0] <= aabb[3] &&
    aabb[1] <= aabb[4] &&
    aabb[2] <= aabb[5] &&
    Number.isFinite(aabb[0]) && Number.isFinite(aabb[3]) &&
    Number.isFinite(aabb[1]) && Number.isFinite(aabb[4]) &&
    Number.isFinite(aabb[2]) && Number.isFinite(aabb[5])
  );
}

function getFrustumHalfExtents(
  projection: ShadowCascadeCameraProjection,
  aspect: number,
  nearDistance: number,
  farDistance: number
): {
  halfNearW: number;
  halfNearH: number;
  halfFarW: number;
  halfFarH: number;
} {
  if (projection.type === "perspective") {
    const fovRad = projection.fovDegrees * Math.PI / 180;
    const tanHalfFov = Math.tan(fovRad * 0.5);
    if (aspect >= 1) {
      const halfNearH = tanHalfFov * nearDistance;
      const halfFarH = tanHalfFov * farDistance;
      return {
        halfNearW: halfNearH * aspect,
        halfNearH,
        halfFarW: halfFarH * aspect,
        halfFarH
      };
    }
    const halfNearW = tanHalfFov * nearDistance;
    const halfFarW = tanHalfFov * farDistance;
    return {
      halfNearW,
      halfNearH: halfNearW / aspect,
      halfFarW,
      halfFarH: halfFarW / aspect
    };
  }
  const halfNearH = projection.scale * 0.5;
  const halfNearW = halfNearH * aspect;
  return {
    halfNearW,
    halfNearH,
    halfFarW: halfNearW,
    halfFarH: halfNearH
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
