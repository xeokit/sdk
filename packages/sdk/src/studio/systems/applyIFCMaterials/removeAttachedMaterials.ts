import type {SceneModel} from "../../../model/scene";
import type {SDKResult} from "../../../base/core";
import {yieldToHost} from "../../../base/utils";
import type {LoaderProgress} from "../../../formats/LoaderProgress";


/**
 * Inverse of {@link applyIFCMaterials}: detaches every SceneMesh
 * from the SceneModel's `_attached_*` materials, destroys those
 * materials and the textures they own, and rebuilds the meshes
 * with their original per-mesh `color` restored.
 *
 * Same detach + destroy + recreate + reattach pattern as
 * `applyIFCMaterials`, run in reverse: `applyIFCMaterials` snapshots
 * `color` through its round-trip so the original mesh colour
 * survives the apply, and this function pulls that colour out of
 * each live SceneMesh on its way back through. A pristine reload
 * of the model isn't required to recover the loaded look.
 *
 * Idempotent: a SceneModel that never had `applyIFCMaterials` run
 * over it is left untouched (no `_attached_*` resources to find).
 *
 * @param params.sceneModel SceneModel to strip materials from.
 *
 * @returns
 *   - `{ok: true}` when the rebuild completes — the SceneModel now
 *     carries colour-only meshes again and the `_attached_*`
 *     materials and textures are gone.
 *   - `{ok: false}` propagating the first SceneModel failure
 *     encountered (mesh-create / mesh-destroy / addMesh).
 */
export async function removeAttachedMaterials(params: {
  sceneModel: SceneModel;
  /**
   * Optional progress callback fired between phases and at
   * intervals during the per-object loops. Same `LoaderProgress`
   * shape the SDK's loaders use.
   */
  onProgress?: (p: LoaderProgress) => void;
  /**
   * Optional `AbortSignal`. When aborted, the function throws
   * `AbortError` from the next `yieldToHost` checkpoint.
   */
  signal?: AbortSignal;
}): Promise<SDKResult<void>> {

  const sceneModel = params.sceneModel;
  const onProgress = params.onProgress;
  const signal     = params.signal;

  const progress: LoaderProgress = {phase: "", current: 0, total: 0};
  const step = async (phase: string, current: number, total: number): Promise<void> => {
    if (onProgress) {
      progress.phase = phase;
      progress.current = current;
      progress.total = total;
      onProgress(progress);
    }
    await yieldToHost(signal);
  };

  type MeshSnap = {
    id:                 string;
    geometryId:         string;
    matrix:             Float64Array<any>;
    opacity:            number;
    color:              [number, number, number];
    parentTransformId?: string;
  };
  type PlanEntry = {
    sceneObj:  ReturnType<typeof getSceneObject>;
    meshSnaps: MeshSnap[];
  };

  function getSceneObject(id: string) { return sceneModel.objects[id]; }


  // ── 1. Plan: identify objects with at least one mesh bound to
  // an `_attached_mat_*` material and snapshot every one of their
  // meshes so the rebuild restores the full per-object mesh set.

  const plan: PlanEntry[] = [];
  const objIds = Object.keys(sceneModel.objects);
  const totalObjects = objIds.length;

  for (let oi = 0; oi < totalObjects; oi++) {
    if ((oi & 0x3F) === 0) await step("Planning removal", oi, totalObjects);
    const objId = objIds[oi];
    const sceneObj = sceneModel.objects[objId];
    let hasAttached = false;
    for (const m of sceneObj.meshes) {
      const matId = m.material ? m.material.id : undefined;
      if (matId && matId.startsWith("_attached_mat_")) {
        hasAttached = true;
        break;
      }
    }
    if (!hasAttached) continue;

    const meshSnaps: MeshSnap[] = [];
    for (const m of sceneObj.meshes) {
      const c = m.color;
      meshSnaps.push({
        id:                m.id,
        geometryId:        m.geometryId,
        matrix:            new Float64Array(m.matrix),
        opacity:           m.opacity,
        color:             [c[0], c[1], c[2]],
        parentTransformId: m.parentTransform ? m.parentTransform.id : undefined,
      });
    }
    plan.push({sceneObj, meshSnaps});
  }


  // ── 2. Detach + destroy every targeted mesh ─────────────────────

  for (let pi = 0, plen = plan.length; pi < plen; pi++) {
    if ((pi & 0x3F) === 0) await step("Removing meshes", pi, plen);
    const entry = plan[pi];
    for (const snap of entry.meshSnaps) {
      const mesh = sceneModel.meshes[snap.id];
      if (!mesh) continue;
      const rr = entry.sceneObj.removeMesh(snap.id);
      if (rr.ok === false) return rr;
      const dr = mesh.destroy();
      if (dr.ok === false) return dr;
    }
  }


  // ── 3. Destroy the `_attached_*` materials and textures ─────────
  //
  // Materials destroy first because SceneTexture refuses to destroy
  // while `numMaterials > 0`. Snapshot keys before mutating.

  await step("Cleaning up materials", 0, 0);
  const oldMaterialIds = Object.keys(sceneModel.materials)
    .filter(id => id.startsWith("_attached_mat_"));
  for (const id of oldMaterialIds) {
    const mat = sceneModel.materials[id];
    if (!mat) continue;
    const dr = mat.destroy();
    if (dr.ok === false) {
      console.warn(`[removeAttachedMaterials] Failed to destroy material '${id}': ${dr.error}`);
    }
  }
  const oldTextureIds = Object.keys(sceneModel.textures)
    .filter(id => id.startsWith("_attached_"));
  for (const id of oldTextureIds) {
    const tex = sceneModel.textures[id];
    if (!tex) continue;
    const dr = tex.destroy();
    if (dr.ok === false) {
      console.warn(`[removeAttachedMaterials] Failed to destroy texture '${id}': ${dr.error}`);
    }
  }


  // ── 4. Recreate every targeted mesh — colour-only (no
  // materialId), with the snapshotted matrix / opacity / colour.

  for (let pi = 0, plen = plan.length; pi < plen; pi++) {
    if ((pi & 0x3F) === 0) await step("Restoring colours", pi, plen);
    const entry = plan[pi];
    for (const snap of entry.meshSnaps) {
      if (!sceneModel.geometries[snap.geometryId]) continue;
      const cr = sceneModel.createMesh({
        id:         snap.id,
        geometryId: snap.geometryId,
        matrix:     snap.matrix,
        opacity:    snap.opacity,
        color:      snap.color,
      });
      if (cr.ok === false) return cr;
      const ar = entry.sceneObj.addMesh(cr.value.id);
      if (ar.ok === false) return ar;
      if (snap.parentTransformId) {
        const lr = cr.value.setParentTransformId(snap.parentTransformId);
        if (lr.ok === false) return lr;
      }
    }
  }

  await step("Restoring colours", plan.length, plan.length);
  return {ok: true, value: undefined};
}
