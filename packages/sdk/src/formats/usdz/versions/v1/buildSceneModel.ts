import {TrianglesPrimitive} from "../../../../base/constants";

/**
 * Maps a parsed tinyusdz scene onto a `SceneModel`.
 *
 * Pure and dependency-light by design: it takes the minimal slices of the
 * tinyusdz and SceneModel APIs it needs (see the `*Like` interfaces), so
 * it can be unit-tested with plain fakes — no wasm, and no import of
 * `base/math` (a 4×4 multiply is inlined to keep it testable).
 *
 * Walks the node tree from the default root, composing each node's local
 * matrix down the hierarchy into a world matrix, and emits:
 *
 *  - one `SceneGeometry` per distinct tinyusdz mesh `contentId` (so
 *    instanced prims share geometry),
 *  - one `SceneMaterial` per distinct `materialId`
 *    (UsdPreviewSurface → PBR),
 *  - one `SceneMesh` per mesh-bearing node (carrying its world matrix),
 *  - one `SceneObject` per mesh-bearing node (id from the USD prim path).
 *
 * tinyusdz returns already-triangulated meshes, so `faceVertexIndices`
 * are used as-is.
 *
 * @internal
 */

/** Minimal view of a tinyusdz node. */
export interface USDNodeLike {
  nodeType?: string;
  absPath?: string;
  primName?: string;
  /** 16-element local transform (column-major, composed down the tree). */
  localMatrix?: ArrayLike<number>;
  /** Index into the scene's mesh table, or < 0 / undefined for non-meshes. */
  contentId?: number;
  /** Plain array, or an embind vector exposing `size()` / `get(i)`. */
  children?: any;
}

/** Minimal view of a tinyusdz mesh. */
export interface USDMeshLike {
  points?: ArrayLike<number>;
  faceVertexIndices?: ArrayLike<number>;
  normals?: ArrayLike<number>;
  texcoords?: ArrayLike<number>;
  vertexColors?: ArrayLike<number>;
  materialId?: number;
}

/** Minimal view of a tinyusdz (UsdPreviewSurface) material. */
export interface USDMaterialLike {
  diffuseColor?: ArrayLike<number>;
  opacity?: number;
  metallic?: number;
  roughness?: number;
  diffuseColorTextureId?: number;
  normalTextureId?: number;
}

/** Minimal view of a tinyusdz scene. */
export interface USDSceneLike {
  getDefaultRootNode(): USDNodeLike;
  getMesh(contentId: number): USDMeshLike | null | undefined;
  getMaterial(materialId: number): USDMaterialLike | null | undefined;
}

/** Minimal view of the SceneModel build API. */
export interface SceneModelLike {
  createGeometry(params: any): any;
  createMaterial(params: any): any;
  createMesh(params: any): any;
  createObject(params: any): any;
}

/** Counts of failed create-calls, surfaced for diagnostics. */
export interface BuildStats {
  geometries: number;
  materials: number;
  meshes: number;
  objects: number;
  failures: number;
}

export function buildSceneModel(scene: USDSceneLike, sceneModel: SceneModelLike): BuildStats {
  const geomByContentId = new Map<number, string>();
  const matByMaterialId = new Map<number, string>();
  const usedObjectIds = new Set<string>();
  const stats: BuildStats = {geometries: 0, materials: 0, meshes: 0, objects: 0, failures: 0};
  let meshSeq = 0;

  const ok = (r: any): boolean => {
    if (r && r.ok === false) { stats.failures++; return false; }
    return true;
  };

  const emitMaterial = (materialId: number | undefined): string | undefined => {
    if (materialId == null || materialId < 0) return undefined;
    const existing = matByMaterialId.get(materialId);
    if (existing) return existing;
    const m = scene.getMaterial(materialId);
    if (!m) return undefined;
    const id = `usd-material-${materialId}`;
    const params: any = {id};
    if (m.diffuseColor && m.diffuseColor.length >= 3) {
      params.color = [m.diffuseColor[0], m.diffuseColor[1], m.diffuseColor[2]];
    }
    if (typeof m.opacity === "number") params.opacity = m.opacity;
    if (typeof m.metallic === "number") params.metallic = m.metallic;
    if (typeof m.roughness === "number") params.roughness = m.roughness;
    if (!ok(sceneModel.createMaterial(params))) return undefined;
    matByMaterialId.set(materialId, id);
    stats.materials++;
    return id;
  };

  const emitMesh = (node: USDNodeLike, worldMatrix: number[]): void => {
    const cid = node.contentId;
    if (cid == null || cid < 0) return;
    const mesh = scene.getMesh(cid);
    if (!mesh || !mesh.points || mesh.points.length === 0) return;

    let geometryId = geomByContentId.get(cid);
    if (!geometryId) {
      geometryId = `usd-geometry-${cid}`;
      const g: any = {id: geometryId, primitive: TrianglesPrimitive, positions: mesh.points};
      if (mesh.faceVertexIndices && mesh.faceVertexIndices.length) g.indices = mesh.faceVertexIndices;
      if (mesh.normals && mesh.normals.length) g.normals = mesh.normals;
      if (mesh.texcoords && mesh.texcoords.length) g.uvs = mesh.texcoords;
      if (mesh.vertexColors && mesh.vertexColors.length) g.colors = mesh.vertexColors;
      if (!ok(sceneModel.createGeometry(g))) return;
      geomByContentId.set(cid, geometryId);
      stats.geometries++;
    }

    const materialId = emitMaterial(mesh.materialId);

    const meshId = `usd-mesh-${meshSeq++}`;
    const meshParams: any = {id: meshId, geometryId, matrix: worldMatrix};
    if (materialId) meshParams.materialId = materialId;
    if (!ok(sceneModel.createMesh(meshParams))) return;
    stats.meshes++;

    const objectId = uniqueId(node.absPath || node.primName || meshId, usedObjectIds);
    if (ok(sceneModel.createObject({id: objectId, meshIds: [meshId]}))) stats.objects++;
  };

  const walk = (node: USDNodeLike, parentWorld: number[]): void => {
    const local = node.localMatrix && node.localMatrix.length === 16
      ? toMat4(node.localMatrix)
      : identity();
    const world = mulMat4(parentWorld, local);
    emitMesh(node, world);
    for (const child of childArray(node.children)) {
      walk(child, world);
    }
  };

  walk(scene.getDefaultRootNode(), identity());
  return stats;
}

// ── helpers ───────────────────────────────────────────────────────────

/** Normalises tinyusdz children (plain array or embind vector). */
function childArray(children: any): USDNodeLike[] {
  if (!children) return [];
  if (Array.isArray(children)) return children;
  if (typeof children.size === "function" && typeof children.get === "function") {
    const out: USDNodeLike[] = [];
    for (let i = 0, n = children.size(); i < n; i++) out.push(children.get(i));
    return out;
  }
  return [];
}

function uniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) { used.add(base); return base; }
  let i = 1;
  while (used.has(`${base}_${i}`)) i++;
  const id = `${base}_${i}`;
  used.add(id);
  return id;
}

function identity(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function toMat4(m: ArrayLike<number>): number[] {
  const out = new Array(16);
  for (let i = 0; i < 16; i++) out[i] = m[i];
  return out;
}

/** Column-major 4×4 multiply: returns a * b. */
function mulMat4(a: number[], b: number[]): number[] {
  const out = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}
