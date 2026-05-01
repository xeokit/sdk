import type {SceneGeometry, SceneMesh, SceneModel, SceneTransform} from "../scene";
import {SDKErrorType, type SDKResult} from "../core";
import {splitSceneGeometry} from "../demo/splitSceneGeometry";
import type {OptimizeSceneModelParams} from "./OptimizeSceneModelParams";
import {inspectSceneModel} from "./inspectSceneModel";


/**
 * Apply demo-grade optimisations to a {@link SceneModel} in place.
 *
 * Passes run in order:
 *
 *   1. **Geometry splitting** — every SceneGeometry whose vertex
 *      count exceeds `maxVertices` or whose primitive count exceeds
 *      `maxPrimitives` is split into two via
 *      {@link splitSceneGeometry} (whole-triangle midpoint partition);
 *      the worklist-driven loop repeats until no piece exceeds either
 *      threshold. Each {@link SceneMesh} that referenced the
 *      pre-split geometry is replicated onto both pieces (detach +
 *      destroy + recreate + reattach), so the parent SceneObject
 *      keeps its full geometric coverage. New mesh / geometry ids are
 *      suffixed `_a` / `_b` per split to stay stable in inspectors.
 *
 *   2. **Unused-resource prune** — mark-and-sweep destruction of
 *      orphan meshes (not attached to a SceneObject), empty
 *      SceneObjects (no live meshes), geometries (no live mesh
 *      references via `geometryId`), materials (no live mesh
 *      `materialId`), transforms (no live mesh `parentTransform`
 *      and no live transform parent-of), and textures (no live
 *      material referencing them). Useful after authoring tools /
 *      loaders that emit speculative resources, and after
 *      `applyIFCMaterials` / `MaterialsPalette.paintMaterial` which
 *      leave the original mesh-bound materials (and their textures)
 *      behind.
 *
 * Before either pass runs, {@link inspectSceneModel} inspects the
 * SceneModel and any **errors** (dangling references, malformed
 * indices, transform cycles, non-finite matrices) cause this
 * function to refuse to run rather than propagate corruption.
 * Warnings are logged via `console.warn` and don't block.
 *
 * Future passes will land here too — geometry deduplication
 * (instancing repeated meshes), batch coalescing (merging meshes
 * that share material + transform), unused-vertex pruning, etc.
 *
 * @param params Configuration; see {@link OptimizeSceneModelParams}.
 * @returns SDKResult — `ok: true` once every pass has completed;
 *   `ok: false` when the SceneModel is missing, destroyed, or
 *   already finalised, or when an underlying mesh / geometry
 *   operation fails.
 */
export function optimizeSceneModel(
  params: OptimizeSceneModelParams,
): SDKResult<void> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    return errInvalid("[optimizeSceneModel] sceneModel is required");
  }
  if (sceneModel.destroyed) {
    return errInvalid("[optimizeSceneModel] SceneModel is destroyed");
  }
  if (sceneModel.finalized) {
    return errInvalid("[optimizeSceneModel] SceneModel is already finalised — split passes need to call createGeometry / createMesh, both of which gate on !finalized");
  }

  // Validate up-front. Errors mean the model violates an invariant
  // the optimiser can't safely tolerate (dangling references,
  // malformed index arrays, transform cycles); warnings are advisory
  // and don't block the run.
  const report = inspectSceneModel({sceneModel});
  for (const w of report.warnings) {
    console.warn(`[optimizeSceneModel] ${w.code}: ${w.message}`);
  }
  if (report.errors.length > 0) {
    const summary = report.errors.slice(0, 5).map(e => `  ${e.code}: ${e.message}`).join("\n");
    const overflow = report.errors.length > 5 ? `\n  ...and ${report.errors.length - 5} more` : "";
    return errInvalid(
      `[optimizeSceneModel] SceneModel validation failed (${report.errors.length} errors):\n${summary}${overflow}`,
    );
  }

  const maxVertices = params.maxVertices ?? 65535;
  const maxPrimitives = params.maxPrimitives ?? 32768;

  const splitRes = splitOversizedGeometries(sceneModel, maxVertices, maxPrimitives);
  if (splitRes.ok === false) {
    return splitRes;
  }

  const pruneRes = pruneUnusedResources(sceneModel);
  if (pruneRes.ok === false) {
    return pruneRes;
  }

  return {ok: true, value: undefined};
}


/**
 * Worklist-driven split pass. Walks every SceneGeometry currently in
 * the model; for each that exceeds either threshold, splits it,
 * replicates referencing meshes onto the two pieces, destroys the
 * original, and pushes the two pieces back onto the worklist.
 */
function splitOversizedGeometries(
  sceneModel: SceneModel,
  maxVertices: number,
  maxPrimitives: number,
): SDKResult<void> {

  // Build geometry-id → meshes-using-it index. Multiple meshes can
  // share a geometry (instancing), so each split fan-outs to all
  // sharing meshes.
  const meshesByGeom = new Map<string, SceneMesh[]>();
  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    const arr = meshesByGeom.get(mesh.geometryId);
    if (arr) {
      arr.push(mesh);
    } else {
      meshesByGeom.set(mesh.geometryId, [mesh]);
    }
  }

  // Worklist of geometry ids to evaluate. Seeded with everything
  // currently in the model; new pieces are pushed on as splits
  // happen so we re-evaluate them for further splitting.
  const worklist: string[] = Object.keys(sceneModel.geometries);

  while (worklist.length > 0) {
    const id = worklist.shift()!;
    const geom = sceneModel.geometries[id];
    if (!geom || geom.destroyed) {
      continue;
    }
    if (!isOversized(geom, maxVertices, maxPrimitives)) {
      continue;
    }
    if (!geom.indices || geom.indices.length === 0) {
      // Points / lines-without-indices can't be split by
      // splitSceneGeometry (it operates on triangle indices). Leave
      // them alone — the GPU is comfortable with un-indexed
      // primitive streams up to its own batch caps anyway.
      continue;
    }

    // Pick child ids that don't collide with anything already in
    // the model. The natural `${id}_a` / `${id}_b` is fine until a
    // user model happens to also carry an id with that suffix.
    const idA = uniqueGeomId(sceneModel, `${id}_a`);
    const idB = uniqueGeomId(sceneModel, `${id}_b`);

    const splitRes = splitSceneGeometry({
      sceneGeometry: geom,
      geometryIdA: idA,
      geometryIdB: idB,
    });
    if (splitRes.ok === false) {
      // Predicate routed every triangle to one side, or some other
      // structural reason the split couldn't run. Leave this
      // geometry as-is; downstream code may still cope with it.
      console.warn(`[optimizeSceneModel] Split skipped for SceneGeometry '${id}': ${splitRes.error}`);
      continue;
    }
    const {geometryA, geometryB} = splitRes.value;

    // Redirect every mesh that referenced the pre-split geometry
    // onto BOTH pieces — each mesh becomes two meshes, both attached
    // to the same SceneObject with the same matrix / opacity /
    // parentTransform.
    const meshes = meshesByGeom.get(id) ?? [];
    const newMeshesForA: SceneMesh[] = [];
    const newMeshesForB: SceneMesh[] = [];

    for (const mesh of meshes) {
      const sceneObject = mesh.object;
      if (!sceneObject || mesh.destroyed) {
        continue;
      }
      const snap = {
        id: mesh.id,
        matrix: new Float64Array(mesh.matrix),
        opacity: mesh.opacity,
        parentTransformId: mesh.parentTransform ? mesh.parentTransform.id : undefined,
      };

      const rmRes = sceneObject.removeMesh(snap.id);
      if (rmRes.ok === false) return rmRes;
      const dRes = mesh.destroy();
      if (dRes.ok === false) return dRes;

      const meshAId = uniqueMeshId(sceneModel, `${snap.id}_a`);
      const meshBId = uniqueMeshId(sceneModel, `${snap.id}_b`);

      const aRes = makeMesh(sceneModel, sceneObject, meshAId, geometryA.id, snap);
      if (aRes.ok === false) return aRes;
      const bRes = makeMesh(sceneModel, sceneObject, meshBId, geometryB.id, snap);
      if (bRes.ok === false) return bRes;

      newMeshesForA.push(aRes.value);
      newMeshesForB.push(bRes.value);
    }

    meshesByGeom.delete(id);
    if (newMeshesForA.length > 0) meshesByGeom.set(geometryA.id, newMeshesForA);
    if (newMeshesForB.length > 0) meshesByGeom.set(geometryB.id, newMeshesForB);

    // Destroy the now-orphaned source geometry.
    const gdRes = geom.destroy();
    if (gdRes.ok === false) return gdRes;

    // Re-queue the pieces — each may itself be oversized.
    worklist.push(geometryA.id, geometryB.id);
  }

  return {ok: true, value: undefined};
}


/**
 * Mark-and-sweep prune of resources nothing live still references.
 *
 * Order matters — meshes are pruned first (so the geometry /
 * material / transform reference sets we build afterwards reflect
 * only live meshes), then the three vertex / shading / hierarchy
 * resources are pruned in any order.
 *
 * "Live mesh" = mesh in `sceneModel.meshes` AND `mesh.object` is a
 * non-null SceneObject still in `sceneModel.objects`. A mesh that
 * was created but never attached, or whose SceneObject has been
 * destroyed, is considered orphan.
 *
 * Transforms are reachability-tracked: a transform is in use if a
 * live mesh names it as `parentTransform`, OR if any in-use
 * transform names it as its own parent (so an ancestor chain stays
 * alive even when only the leaf is mesh-referenced).
 */
function pruneUnusedResources(sceneModel: SceneModel): SDKResult<void> {

  // ── 1. Orphan meshes ─────────────────────────────────────────
  const orphanMeshIds: string[] = [];
  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    if (mesh.destroyed) continue;
    const obj = mesh.object;
    if (!obj || obj.destroyed || !sceneModel.objects[obj.id]) {
      orphanMeshIds.push(meshId);
    }
  }
  for (const meshId of orphanMeshIds) {
    const mesh = sceneModel.meshes[meshId];
    if (!mesh || mesh.destroyed) continue;
    const r = mesh.destroy();
    if (r.ok === false) return r;
  }

  // ── 2. Empty SceneObjects ────────────────────────────────────
  // After mesh prune, an object whose mesh list is empty has
  // nothing to render. Drop it so the View doesn't keep a dead
  // ViewObject mirror around.
  const emptyObjectIds: string[] = [];
  for (const objId in sceneModel.objects) {
    const obj = sceneModel.objects[objId];
    if (obj.destroyed) continue;
    if (!obj.meshes || obj.meshes.length === 0) {
      emptyObjectIds.push(objId);
    }
  }
  for (const objId of emptyObjectIds) {
    const obj = sceneModel.objects[objId];
    if (!obj || obj.destroyed) continue;
    const r = obj.destroy();
    if (r.ok === false) return r;
  }

  // ── 3. Build "in use" sets from surviving meshes ─────────────
  const usedGeomIds      = new Set<string>();
  const usedMaterialIds  = new Set<string>();
  const usedTransformIds = new Set<string>();
  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    if (mesh.destroyed) continue;
    if (mesh.geometryId) usedGeomIds.add(mesh.geometryId);
    if (mesh.materialId) usedMaterialIds.add(mesh.materialId);
    if (mesh.parentTransform) {
      usedTransformIds.add(mesh.parentTransform.id);
    }
  }

  // ── 4. Walk transform parent chains to keep ancestors alive ──
  // Iterate fixpoint-style: each pass adds parents of in-use
  // transforms. Terminates when no new transforms get added.
  let added = true;
  while (added) {
    added = false;
    for (const tId of usedTransformIds) {
      const t: SceneTransform | undefined = sceneModel.transforms[tId];
      if (!t || t.destroyed) continue;
      const parent = t.parentTransform;
      if (parent && !usedTransformIds.has(parent.id)) {
        usedTransformIds.add(parent.id);
        added = true;
      }
    }
  }

  // ── 5. Destroy geometries / materials / transforms not in use ─
  for (const geomId in sceneModel.geometries) {
    if (usedGeomIds.has(geomId)) continue;
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) continue;
    const r = geom.destroy();
    if (r.ok === false) return r;
  }
  for (const matId in sceneModel.materials) {
    if (usedMaterialIds.has(matId)) continue;
    const mat = sceneModel.materials[matId];
    if (!mat || mat.destroyed) continue;
    const r = mat.destroy();
    if (r.ok === false) return r;
  }
  for (const tId in sceneModel.transforms) {
    if (usedTransformIds.has(tId)) continue;
    const t = sceneModel.transforms[tId];
    if (!t || t.destroyed) continue;
    const r = t.destroy();
    if (r.ok === false) return r;
  }

  // ── 6. Orphan textures ───────────────────────────────────────
  // Only collectable AFTER materials are pruned — a texture used
  // by a now-destroyed material had its reference disappear here.
  // Build the in-use set from the surviving materials' three
  // texture slots.
  const usedTextureIds = new Set<string>();
  for (const matId in sceneModel.materials) {
    const mat = sceneModel.materials[matId];
    if (mat.destroyed) continue;
    if (mat.colorTexture)              usedTextureIds.add(mat.colorTexture.id);
    if (mat.normalsTexture)            usedTextureIds.add(mat.normalsTexture.id);
    if (mat.metallicRoughnessTexture)  usedTextureIds.add(mat.metallicRoughnessTexture.id);
  }
  for (const texId in sceneModel.textures) {
    if (usedTextureIds.has(texId)) continue;
    const tex = sceneModel.textures[texId];
    if (!tex || tex.destroyed) continue;
    const r = tex.destroy();
    if (r.ok === false) return r;
  }

  return {ok: true, value: undefined};
}


/**
 * Returns `true` if the geometry exceeds either the vertex- or
 * primitive-count threshold. Primitive count is derived from
 * `indices.length / vertsPerPrim`; for the moment we only
 * triangle-split, so non-triangle geometries (Lines, Points) trip
 * only on the vertex threshold.
 */
function isOversized(
  geom: SceneGeometry,
  maxVertices: number,
  maxPrimitives: number,
): boolean {
  const vertCount = geom.positionsCompressed
    ? (geom.positionsCompressed.length / 3) | 0
    : 0;
  if (vertCount > maxVertices) return true;
  const triCount = geom.indices ? (geom.indices.length / 3) | 0 : 0;
  return triCount > maxPrimitives;
}


/**
 * Detach + destroy + recreate + reattach for a single mesh — uses
 * the supported SceneModel mutation pattern (see comment on
 * `applyIFCMaterials` for the rationale). Caller is responsible for
 * already having destroyed the source mesh; this builds the
 * replacement mesh against a new geometry.
 */
function makeMesh(
  sceneModel: SceneModel,
  sceneObject: SceneMesh["object"],
  meshId: string,
  geometryId: string,
  snap: {
    matrix: Float64Array<any>;
    opacity: number;
    parentTransformId: string | undefined;
  },
): SDKResult<SceneMesh> {
  const cRes = sceneModel.createMesh({
    id: meshId,
    geometryId,
    matrix: snap.matrix,
    opacity: snap.opacity,
  });
  if (cRes.ok === false) return cRes;

  if (!sceneObject) {
    return {
      ok: false,
      type: SDKErrorType.InvalidOperation,
      error: `[optimizeSceneModel.makeMesh] SceneMesh '${meshId}' has no SceneObject — original mesh was dangling`,
    };
  }

  const aRes = sceneObject.addMesh(cRes.value.id);
  if (aRes.ok === false) return aRes;

  if (snap.parentTransformId) {
    const tRes = cRes.value.setParentTransformId(snap.parentTransformId);
    if (tRes.ok === false) return tRes;
  }
  return cRes;
}


/**
 * Find the first id matching `${baseId}` / `${baseId}_2` / … that
 * isn't already taken in `sceneModel.geometries`. Splits typically
 * land on `${id}_a` / `${id}_b` directly; the suffix-counter is
 * just a safety net for the unusual case where a user model happens
 * to ship those names too.
 */
function uniqueGeomId(sceneModel: SceneModel, baseId: string): string {
  if (!sceneModel.geometries[baseId]) return baseId;
  let i = 2;
  while (sceneModel.geometries[`${baseId}_${i}`]) i++;
  return `${baseId}_${i}`;
}


/** As {@link uniqueGeomId} but for `sceneModel.meshes`. */
function uniqueMeshId(sceneModel: SceneModel, baseId: string): string {
  if (!sceneModel.meshes[baseId]) return baseId;
  let i = 2;
  while (sceneModel.meshes[`${baseId}_${i}`]) i++;
  return `${baseId}_${i}`;
}


function errInvalid<T>(message: string): SDKResult<T> {
  return {ok: false, type: SDKErrorType.InvalidOperation, error: message};
}
