/**
 * Headless performance/scale metrics for a loaded {@link Scene}.
 *
 * All metrics here are CPU-side and deterministic — no WebGL context is
 * needed — so they run in Node/jest and gate against a committed baseline.
 * They cover the load/memory/culling side of scale; GPU frame-time is a
 * separate browser-based concern.
 */

import {Scene, SceneModel} from "../model/scene";
import {
  LinesPrimitive,
  PointsPrimitive,
  GaussianSplatsPrimitive,
} from "../base/constants";
import {getSceneCollisionIndex} from "../spatial/collision/getSceneCollisionIndex";
import {CullBoundsMirror} from "../spatial/culling/CullBoundsMirror";
import {createCullKernel} from "../spatial/culling/CullKernel";
import type {CullingOutputMessage, ViewChangedMessage} from "../spatial/culling/CullingProtocol";
import {setFrustum3} from "../base/math/boundaries";
import {lookAtMat4v, perspectiveMat4} from "../base/math/matrix";

/** Deterministic structural + memory metrics for one SceneModel. */
export interface StructuralMetrics {
  numObjects: number;
  numMeshes: number;
  numGeometries: number;
  numTextures: number;
  /** Triangles across unique geometries (the resident geometry). */
  uniqueTriangles: number;
  /** Triangles across all meshes (the per-frame draw load; shared geometry counted per mesh). */
  instancedTriangles: number;
  /** Meshes per unique geometry — instancing effectiveness, 3 dp. */
  geometryReuseRatio: number;
  /** CPU footprint of compressed geometry buffers, bytes (proxy for GPU memory). */
  compressedGeometryBytes: number;
}

/** Cull-pass throughput + effectiveness for one camera. */
export interface CullMetrics {
  items: number;
  culled: number;
  visible: number;
}

function triangleCount(primitive: number, indexLen: number, posLen: number): number {
  if (primitive === LinesPrimitive || primitive === PointsPrimitive || primitive === GaussianSplatsPrimitive) {
    return 0;
  }
  return indexLen > 0 ? (indexLen / 3) | 0 : (posLen / 9) | 0;
}

function byteLen(a: {byteLength?: number; length?: number} | undefined): number {
  if (!a) return 0;
  return a.byteLength ?? (a.length ?? 0);
}

/** Collects deterministic structural + memory metrics from a SceneModel. */
export function collectStructuralMetrics(sceneModel: SceneModel): StructuralMetrics {
  const geometries = Object.values(sceneModel.geometries);
  const meshes = Object.values(sceneModel.meshes);

  const triByGeometry = new Map<string, number>();
  let uniqueTriangles = 0;
  let compressedGeometryBytes = 0;

  for (const geom of geometries) {
    const tris = triangleCount(
      geom.primitive,
      geom.indices ? geom.indices.length : 0,
      geom.positionsCompressed ? geom.positionsCompressed.length : 0,
    );
    triByGeometry.set(geom.id, tris);
    uniqueTriangles += tris;
    compressedGeometryBytes +=
      byteLen(geom.positionsCompressed) +
      byteLen(geom.normalsCompressed) +
      byteLen(geom.uvsCompressed) +
      byteLen(geom.indices) +
      byteLen(geom.edgeIndices);
  }

  let instancedTriangles = 0;
  for (const mesh of meshes) {
    instancedTriangles += triByGeometry.get(mesh.geometry.id) ?? 0;
  }

  const numGeometries = geometries.length;
  const numMeshes = meshes.length;
  return {
    numObjects: Object.keys(sceneModel.objects).length,
    numMeshes,
    numGeometries,
    numTextures: Object.keys(sceneModel.textures).length,
    uniqueTriangles,
    instancedTriangles,
    geometryReuseRatio: numGeometries > 0 ? Math.round((numMeshes / numGeometries) * 1000) / 1000 : 0,
    compressedGeometryBytes,
  };
}

/**
 * Runs one frustum + solid-angle cull pass over the scene's objects for a
 * camera framed on the scene bounds, returning how many objects the kernel
 * culls. Drives {@link createCullKernel} directly — the same path its unit
 * tests use — so no Worker is needed.
 */
export function runCullPass(scene: Scene): CullMetrics {
  const collisionIndex = getSceneCollisionIndex(scene);
  const mirror = new CullBoundsMirror(collisionIndex);
  for (const id in scene.objects) {
    mirror.put(id, true);
  }
  const items = mirror.marshal();
  if (!items || items.indices.length === 0) {
    return {items: 0, culled: 0, visible: 0};
  }

  const kernel = createCullKernel();
  const out: CullingOutputMessage[] = [];
  const post = (m: CullingOutputMessage) => out.push(m);
  kernel.handleMessage(items, post);

  const aabb = collisionIndex.getSceneAABB();
  const cx = aabb ? (aabb[0] + aabb[3]) * 0.5 : 0;
  const cy = aabb ? (aabb[1] + aabb[4]) * 0.5 : 0;
  const cz = aabb ? (aabb[2] + aabb[5]) * 0.5 : 0;
  const r = aabb
    ? Math.hypot(aabb[3] - aabb[0], aabb[4] - aabb[1], aabb[5] - aabb[2]) * 0.5 || 1
    : 1;
  // Interior view from the bounds centre looking along +Z — only part of the
  // scene falls in the frustum, so this actually exercises frustum + solid-angle
  // culling (objects behind / off to the sides are culled). A whole-scene
  // framing would cull nothing and wouldn't baseline the cull path.
  kernel.handleMessage(viewChanged("perf", [cx, cy, cz], [cx, cy, cz + r]), post);

  let culled = 0;
  for (const m of out) {
    if (m.type === "CullResults") culled += m.newlyCulled.length - m.newlyUnCulled.length;
  }
  const total = items.indices.length;
  return {items: total, culled, visible: total - culled};
}

function viewChanged(
  viewId: string,
  eye: [number, number, number],
  look: [number, number, number],
): ViewChangedMessage {
  const viewMat = lookAtMat4v(eye, look, [0, 1, 0]);
  const projMat = perspectiveMat4(Math.PI / 3, 1, 0.1, 1e7);
  const frustum = setFrustum3(viewMat, projMat);
  const planes = new Float64Array(24);
  for (let i = 0; i < 6; i++) {
    const p = frustum.planes[i];
    planes[i * 4] = p.normal[0];
    planes[i * 4 + 1] = p.normal[1];
    planes[i * 4 + 2] = p.normal[2];
    planes[i * 4 + 3] = p.offset;
  }
  return {type: "ViewChanged", viewId, planes, eye: new Float64Array(eye), solidAngleLimit: 0.004};
}
