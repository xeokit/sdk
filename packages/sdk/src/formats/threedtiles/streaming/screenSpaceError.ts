/**
 * Screen-space-error (SSE) computation and tile selection for streaming. These
 * are pure functions of the tile tree and the camera state, so the selection
 * logic is testable without a renderer.
 */

import type {Vec3} from "../../../base/math/vector";
import type {Mat4} from "../../../base/math/matrix";
import {Frustum3, intersectFrustum3AABB3, OUTSIDE, setFrustum3} from "../../../base/math/boundaries";
import type {TileNode} from "./TileTree";

export interface CameraState {
  /** World-space eye position. */
  eye: Vec3;
  /** Viewport height in pixels. */
  viewportHeight: number;
  /** Vertical field of view in degrees. */
  fov: number;
  /** View matrix; with `projMatrix`, enables frustum culling. */
  viewMatrix?: Mat4;
  /** Projection matrix; with `viewMatrix`, enables frustum culling. */
  projMatrix?: Mat4;
}

/** Nearest distance from `eye` to a bounding sphere (0 inside). */
export function distanceToTile(eye: Vec3, sphere: {center: Vec3; radius: number}): number {
  const d = Math.hypot(eye[0] - sphere.center[0], eye[1] - sphere.center[1], eye[2] - sphere.center[2]);
  return Math.max(0, d - sphere.radius);
}

/**
 * Screen-space error in pixels: the tile's geometric error projected to screen
 * size at `distance`. Returns `Infinity` at distance 0 so the tile always
 * refines.
 */
export function screenSpaceError(geometricError: number, distance: number, viewportHeight: number, fovDegrees: number): number {
  if (distance <= 0) return Infinity;
  const fovRad = (fovDegrees * Math.PI) / 180;
  return (geometricError * viewportHeight) / (distance * 2 * Math.tan(fovRad / 2));
}

/**
 * Selects the tiles to render for `camera`, descending while a tile's SSE
 * exceeds `maxScreenSpaceError` and it has children. REPLACE renders a tile
 * only when it is not refined further (leaf or good enough); ADD renders the
 * tile and still descends. When `camera` carries view + projection matrices,
 * tiles whose bounding volume falls entirely outside the camera frustum (and
 * their subtrees) are culled.
 */
export function selectTiles(root: TileNode, camera: CameraState, maxScreenSpaceError: number): TileNode[] {
  const out: TileNode[] = [];
  const frustum = camera.viewMatrix && camera.projMatrix
    ? setFrustum3(camera.viewMatrix, camera.projMatrix, new Frustum3())
    : null;
  const culled = (node: TileNode): boolean => {
    if (!frustum) return false;
    const r = node.radius;
    const c = node.center;
    return intersectFrustum3AABB3(frustum, [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r]) === OUTSIDE;
  };
  const visit = (node: TileNode): void => {
    if (culled(node)) return;
    const distance = distanceToTile(camera.eye, node);
    const sse = screenSpaceError(node.geometricError, distance, camera.viewportHeight, camera.fov);
    const refine = node.children.length > 0 && sse > maxScreenSpaceError;

    if (node.refine === "ADD") {
      if (node.contentUri) out.push(node);
      if (refine) node.children.forEach(visit);
    } else {
      if (refine) {
        node.children.forEach(visit);
      } else if (node.contentUri) {
        out.push(node);
      }
    }
  };
  visit(root);
  return out;
}
