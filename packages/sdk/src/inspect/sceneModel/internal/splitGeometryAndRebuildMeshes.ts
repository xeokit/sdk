import type {SceneGeometry, SceneModel, SceneObject} from "../../../model/scene";
import {type SDKResult} from "../../../base/core";
import {splitSceneGeometry} from "../../../demo/splitSceneGeometry";
import type {FixApplyResult} from "../Fix";


/**
 * Internal helper shared by every fix strategy that needs to split
 * a {@link model!scene.SceneGeometry | SceneGeometry} in two and fan referencing meshes onto
 * the resulting pieces. Same supported pattern
 * {@link applyIFCMaterials} / {@link demo.materials.MaterialsPalette}
 * use: detach + destroy + recreate + reattach, with a snapshot of
 * each mesh's id / matrix / opacity / parentTransform preserved
 * across the rebuild.
 *
 * Steps:
 *
 *   1. Split the source geometry via {@link splitSceneGeometry}
 *      (whole-triangle midpoint partition). Returns
 *      `{fixed: false}` cleanly when the predicate routes every
 *      triangle to one side (cannot make progress).
 *   2. Snapshot every {@link model!scene.SceneMesh | SceneMesh} that referenced the source.
 *   3. For each snapshot: remove from its SceneObject, destroy it,
 *      then create two new meshes (`{id}_a` / `{id}_b`) — one
 *      against each half — and reattach to the same SceneObject.
 *   4. Destroy the source geometry.
 *
 * @param sceneModel SceneModel containing the source geometry.
 * @param geometryId Id of the source geometry to split.
 * @returns SDKResult — `ok: true` with `{fixed: boolean}` flag
 *   indicating whether anything was actually split. `ok: false`
 *   for lifecycle / underlying SDK errors.
 */
export function splitGeometryAndRebuildMeshes(
  sceneModel: SceneModel,
  geometryId: string,
): SDKResult<FixApplyResult> {

  const geom = sceneModel.geometries[geometryId];
  if (!geom || geom.destroyed) {
    return {ok: true, value: {fixed: false, reason: "target-missing"}};
  }
  if (!geom.indices || geom.indices.length === 0) {
    return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
  }

  const idA = uniqueGeomId(sceneModel, `${geometryId}_a`);
  const idB = uniqueGeomId(sceneModel, `${geometryId}_b`);

  // Snapshot every mesh that points at the source BEFORE the
  // rebuild loop — destroying + recreating meshes invalidates
  // live iteration of `sceneModel.meshes`. Snapshot every visible
  // attribute the SDK lets you set at create time so the rebuilt
  // pieces aren't visually different from the originals.
  const targets: Array<{
    sceneObjectId: string;
    snap: {
      id:                string;
      matrix:            Float64Array<any>;
      color:             [number, number, number];
      opacity:           number;
      materialId:        string | undefined;
      parentTransformId: string | undefined;
    };
  }> = [];
  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    if (mesh.destroyed) continue;
    if (mesh.geometryId !== geometryId) continue;
    const obj = mesh.object;
    if (!obj || obj.destroyed) continue;
    targets.push({
      sceneObjectId: obj.id,
      snap: {
        id:                mesh.id,
        matrix:            new Float64Array(mesh.matrix),
        color:             [mesh.color[0], mesh.color[1], mesh.color[2]],
        opacity:           mesh.opacity,
        materialId:        mesh.materialId,
        parentTransformId: mesh.parentTransform ? mesh.parentTransform.id : undefined,
      },
    });
  }

  const splitRes = splitSceneGeometry({
    sceneGeometry: geom,
    geometryIdA:   idA,
    geometryIdB:   idB,
  });
  if (splitRes.ok === false) {
    // Predicate routed every triangle to one side, or some other
    // structural reason the split couldn't run. Leave the
    // geometry untouched.
    return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
  }
  const {geometryA, geometryB} = splitRes.value;

  for (const {sceneObjectId, snap} of targets) {
    const obj = sceneModel.objects[sceneObjectId];
    if (!obj || obj.destroyed) continue;
    const mesh = sceneModel.meshes[snap.id];
    if (!mesh || mesh.destroyed) continue;

    const rRes = obj.removeMesh(snap.id);
    if (rRes.ok === false) return rRes;
    const dRes = mesh.destroy();
    if (dRes.ok === false) return dRes;

    const meshAId = uniqueMeshId(sceneModel, `${snap.id}_a`);
    const meshBId = uniqueMeshId(sceneModel, `${snap.id}_b`);

    const aRes = makeMesh(sceneModel, obj, meshAId, geometryA.id, snap);
    if (aRes.ok === false) return aRes;
    const bRes = makeMesh(sceneModel, obj, meshBId, geometryB.id, snap);
    if (bRes.ok === false) return bRes;
  }

  const gdRes = geom.destroy();
  if (gdRes.ok === false) return gdRes;

  return {
    ok: true,
    value: {
      fixed: true,
      trace: `'${geometryId}' → split into '${idA}' / '${idB}'; ${targets.length} mesh${targets.length === 1 ? "" : "es"} rebuilt`,
    },
  };
}


function makeMesh(
  sceneModel:  SceneModel,
  sceneObject: SceneObject,
  meshId:      string,
  geometryId:  string,
  snap:        {
    matrix:            Float64Array;
    color:             [number, number, number];
    opacity:           number;
    materialId:        string | undefined;
    parentTransformId: string | undefined;
  },
): SDKResult<unknown> {
  const cRes = sceneModel.createMesh({
    id:         meshId,
    geometryId,
    matrix:     snap.matrix,
    color:      snap.color,
    opacity:    snap.opacity,
    ...(snap.materialId ? {materialId: snap.materialId} : {}),
  });
  if (cRes.ok === false) return cRes;
  const aRes = sceneObject.addMesh(cRes.value.id);
  if (aRes.ok === false) return aRes;
  if (snap.parentTransformId) {
    const tRes = cRes.value.setParentTransformId(snap.parentTransformId);
    if (tRes.ok === false) return tRes;
  }
  return cRes;
}


function uniqueGeomId(sceneModel: SceneModel, baseId: string): string {
  if (!sceneModel.geometries[baseId]) return baseId;
  let i = 2;
  while (sceneModel.geometries[`${baseId}_${i}`]) i++;
  return `${baseId}_${i}`;
}


function uniqueMeshId(sceneModel: SceneModel, baseId: string): string {
  if (!sceneModel.meshes[baseId]) return baseId;
  let i = 2;
  while (sceneModel.meshes[`${baseId}_${i}`]) i++;
  return `${baseId}_${i}`;
}
