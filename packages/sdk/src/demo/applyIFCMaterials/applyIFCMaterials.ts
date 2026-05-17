import type {SceneModel} from "../../model/scene";
import type {DataModel, DataObject} from "../../model/data";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {LinearEncoding, LinearFilter, sRGBEncoding} from "../../base/constants";
import {yieldToHost} from "../../base/utils";

import type {LoaderProgress} from "../../formats/LoaderProgress";
import {ensureGeometryAttribs} from "../ensureGeometryAttribs";

import {DEFAULT_IFC_PAINTERS}    from "./DEFAULT_IFC_PAINTERS";
import {DEFAULT_IFC_NAME_RULES}  from "./DEFAULT_IFC_NAME_RULES";
import {FALLBACK_IFC_PAINTER}    from "./FALLBACK_IFC_PAINTER";
import type {IfcPainterEntry}    from "./IfcPainterEntry";
import type {IfcNameRule}        from "./IfcNameRule";
import type {IfcPropertyRule}    from "./IfcPropertyRule";


/**
 * Walks the `SceneObject`s of an already-populated `SceneModel`,
 * looks up each one's IFC type in the matching `DataModel`, and
 * attaches a procedurally-painted `SceneMaterial` to every
 * `SceneMesh` of that object via the mesh's `materialId` setter.
 * Materials are created lazily — one shared `SceneMaterial` per IFC
 * type — and added to the same `SceneModel` alongside the three
 * `SceneTexture`s (colour, normal, metallic-roughness) they
 * reference.
 *
 * The painted materials all carry textures; the SceneGeometries
 * coming out of an IFC loader carry no UVs. The renderer detects
 * the mismatch and dispatches those meshes to its triplanar
 * shader variant, which derives sample coordinates from world
 * position scaled by the material's `triplanarScale`. Per-vertex
 * smooth normals are auto-filled inside `SceneModel.createGeometry`,
 * so painted IFC meshes route through the smooth-shaded PBR path
 * without any post-construction geometry mutation.
 *
 * Mutation-only — no mesh / object recreation. Whether the renderer
 * picks the new material up at render time depends on whether it
 * subscribes to the SceneModel's mesh-material-changed events.
 *
 * Expectations:
 *
 *   - `DataObject.id === SceneObject.id` for matching pairs (the
 *     convention every loader the SDK ships produces).
 */
export async function applyIFCMaterials(params: {

  sceneModel: SceneModel;
  dataModel:  DataModel;

  /** Painter texture size in pixels (square). Default `256`. */
  textureSize?: number;

  /**
   * Approximate metres of geometry per texture repeat. Forwarded to
   * each created `SceneMaterial` as `triplanarScale`, which the
   * renderer's triplanar texture-sampling fallback uses to scale
   * world-space UVs on UV-less geometry (typical for IFC). Smaller
   * values tile the texture more times across each surface.
   * Default `1.0`.
   */
  uvScale?: number;

  /**
   * Per-IFC-type painter overrides, merged into
   * {@link DEFAULT_IFC_PAINTERS}. Pass an empty object to start from
   * the defaults; pass a populated object to override or add types.
   */
  painters?: Record<string, IfcPainterEntry>;

  /**
   * Optional resolver returning the painter-table key for a given
   * SceneObject. Runs first — when it returns a defined string the
   * name-rule and property-rule resolvers below are skipped. Use this
   * for free-form routing decisions that don't fit a regex on `name`
   * or a property predicate.
   *
   * Returning `undefined` defers to the {@link IfcNameRule} list,
   * then to the {@link IfcPropertyRule} list, then to
   * `dataObject.type`.
   */
  resolveIfcType?: (objectId: string, dataObject: DataObject | undefined) => string | undefined;

  /**
   * Name-pattern rules tested against `dataObject.name`, in order.
   * First match wins, picking the rule's painter-table key.
   *
   * Defaults to {@link DEFAULT_IFC_NAME_RULES} (covers
   * vegetation-style proxy elements). Pass an explicit array to
   * replace the defaults; spread them (`[...DEFAULT_IFC_NAME_RULES,
   * ...mine]`) to extend.
   */
  nameRules?: IfcNameRule[];

  /**
   * Property-predicate rules inspecting `dataObject.propertySets`,
   * in order. First match wins. Use to discriminate same-IFC-type
   * objects by their PropertySet contents — e.g. routing
   * `Pset_WallCommon.IsExternal === true` walls to a different
   * painter than interior walls.
   *
   * Defaults to an empty list. The {@link getDataProperty} helper
   * makes predicates concise.
   */
  propertyRules?: IfcPropertyRule[];

  /**
   * Optional progress callback fired between phases and at
   * intervals during the per-object loops. Same `LoaderProgress`
   * shape the SDK's loaders use, so a UI built for one is
   * directly reusable for the other.
   */
  onProgress?: (p: LoaderProgress) => void;

  /**
   * Optional `AbortSignal`. When aborted, the function throws
   * `AbortError` from the next `yieldToHost` checkpoint. Mid-abort
   * state is *not* rolled back — meshes already destroyed are
   * gone, materials already created stay; the caller should
   * recover by re-running `applyIFCMaterials` or
   * {@link removeAttachedMaterials}.
   */
  signal?: AbortSignal;

}): Promise<SDKResult<void>> {

  const sceneModel  = params.sceneModel;
  const dataModel   = params.dataModel;
  const textureSize = params.textureSize ?? 256;
  const uvScale     = params.uvScale     ?? 1.0;
  const onProgress  = params.onProgress;
  const signal      = params.signal;

  const painterMap: Record<string, IfcPainterEntry> = {
    ...DEFAULT_IFC_PAINTERS,
    ...(params.painters || {}),
  };

  // Reusable progress payload — mutated and re-emitted to avoid
  // per-yield allocations. Consumers that retain a snapshot must
  // copy fields out themselves.
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


  // ── 1. Plan: resolve ifcType + snapshot meshes for every object ─
  //
  // Single planning pass so the subsequent destroy + create phases
  // can run in dependency order (meshes before materials before
  // textures, then textures before materials before meshes).
  // Splitting the work this way is what lets us re-apply over a
  // SceneModel that already carries `_attached_*` materials from a
  // prior call without `createTexture` colliding on the existing ids.

  const resolveIfcType = params.resolveIfcType;
  const nameRules      = params.nameRules     ?? DEFAULT_IFC_NAME_RULES;
  const propertyRules  = params.propertyRules ?? [];

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
    objId:     string;
    ifcType:   string;
    meshSnaps: MeshSnap[];
  };

  function getSceneObject(id: string) { return sceneModel.objects[id]; }

  const plan: PlanEntry[] = [];
  const objIds = Object.keys(sceneModel.objects);
  const totalObjects = objIds.length;

  for (let oi = 0; oi < totalObjects; oi++) {
    if ((oi & 0x3F) === 0) await step("Planning materials", oi, totalObjects);
    const objId = objIds[oi];
    const sceneObj = sceneModel.objects[objId];
    const dataObj  = dataModel.objects[objId];

    // Resolution order:
    //   1. resolveIfcType callback (if it returns a defined key)
    //   2. first matching name rule (regex on dataObject.name)
    //   3. first matching property rule (predicate on dataObject)
    //   4. dataObject.type
    //   5. "_default"
    let ifcType: string | undefined =
      resolveIfcType ? resolveIfcType(objId, dataObj) : undefined;

    if (ifcType === undefined) {
      const name = dataObj?.name;
      if (name) {
        for (const rule of nameRules) {
          if (rule.pattern.test(name)) {
            ifcType = rule.key;
            break;
          }
        }
      }
    }

    if (ifcType === undefined && propertyRules.length > 0) {
      for (const rule of propertyRules) {
        if (rule.predicate(dataObj)) {
          ifcType = rule.key;
          break;
        }
      }
    }

    if (ifcType === undefined) {
      ifcType = (dataObj && dataObj.type) ?? "_default";
    }

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

    plan.push({sceneObj, objId, ifcType, meshSnaps});
  }


  // ── 3. Detach + destroy every targeted mesh ─────────────────────
  //
  // SceneMesh's material / geometry bindings are immutable, so the
  // supported pattern for "reskinning" is detach + destroy + recreate
  // + reattach: sceneObj.removeMesh + mesh.destroy, then
  // sceneModel.createMesh + sceneObj.addMesh. Each object keeps its
  // identity (and id) — only its meshes get swapped.
  //
  // Doing this in one sweep — before any new material creation —
  // releases every reference to the prior `_attached_*` materials
  // so we can safely destroy and recreate them below.

  for (let pi = 0, plen = plan.length; pi < plen; pi++) {
    if ((pi & 0x3F) === 0) await step("Removing old meshes", pi, plen);
    const entry = plan[pi];
    for (const snap of entry.meshSnaps) {
      const mesh = sceneModel.meshes[snap.id];
      if (!mesh) {
        continue;
      }
      const rr = entry.sceneObj.removeMesh(snap.id);
      if (rr.ok === false) {
        return rr;
      }
      const dr = mesh.destroy();
      if (dr.ok === false) {
        return dr;
      }
    }
  }


  // ── 4. Destroy any prior _attached_* materials and textures ─────
  //
  // Safe to drop now that no SceneMesh in this SceneModel still
  // references them (Pass 3 destroyed every mesh on every object;
  // this function targets all SceneObjects, so nothing else can be
  // holding a reference). Materials destroy first because
  // SceneTexture refuses while `numMaterials > 0`. Snapshot keys
  // before iterating so the live deletes don't disturb the loop.

  await step("Cleaning up old materials", 0, 0);
  const oldMaterialIds = Object.keys(sceneModel.materials)
    .filter(id => id.startsWith("_attached_mat_"));
  for (const id of oldMaterialIds) {
    const mat = sceneModel.materials[id];
    if (!mat) continue;
    const dr = mat.destroy();
    if (dr.ok === false) {
      console.warn(`[applyIFCMaterials] Failed to destroy stale material '${id}': ${dr.error}`);
    }
  }
  const oldTextureIds = Object.keys(sceneModel.textures)
    .filter(id => id.startsWith("_attached_"));
  for (const id of oldTextureIds) {
    const tex = sceneModel.textures[id];
    if (!tex) continue;
    const dr = tex.destroy();
    if (dr.ok === false) {
      console.warn(`[applyIFCMaterials] Failed to destroy stale texture '${id}': ${dr.error}`);
    }
  }


  // ── 5. Materials, lazily painted on first use of each IFC type ─
  //
  // Cached so e.g. 500 walls share a single `paintBrick` call.

  const materialIdsByType: Record<string, string> = {};

  const ensureMaterial = (ifcType: string): string | null => {
    const existing = materialIdsByType[ifcType];
    if (existing) {
      return existing;
    }

    const entry = painterMap[ifcType] ?? FALLBACK_IFC_PAINTER;
    const matId = `_attached_mat_${ifcType}`;
    const cTex  = `_attached_${ifcType}_color`;
    const nTex  = `_attached_${ifcType}_normal`;
    const mTex  = `_attached_${ifcType}_mr`;

    const maps = entry.paint(textureSize);

    const cR = sceneModel.createTexture({id: cTex, imageData: maps.color,  encoding: sRGBEncoding,   minFilter: LinearFilter, flipY: false});
    const nR = sceneModel.createTexture({id: nTex, imageData: maps.normal, encoding: LinearEncoding, minFilter: LinearFilter, flipY: false});
    const mR = sceneModel.createTexture({id: mTex, imageData: maps.mr,     encoding: LinearEncoding, minFilter: LinearFilter, flipY: false});

    if (cR.ok === false) console.warn(`[applyIFCMaterials] createTexture(${cTex}) failed:`, cR.error);
    if (nR.ok === false) console.warn(`[applyIFCMaterials] createTexture(${nTex}) failed:`, nR.error);
    if (mR.ok === false) console.warn(`[applyIFCMaterials] createTexture(${mTex}) failed:`, mR.error);

    const matRes = sceneModel.createMaterial({
      id:                         matId,
      colorTextureId:             cTex,
      normalsTextureId:           nTex,
      metallicRoughnessTextureId: mTex,
      // The IFC pipeline emits geometry without UVs; the renderer
      // routes its textured materials through the triplanar
      // fallback, which reads `triplanarScale` to convert world
      // position into per-fragment sample coordinates.
      triplanarScale:             uvScale,
      ...(entry.material || {}),
    });
    if (matRes.ok === false) {
      return null;
    }

    materialIdsByType[ifcType] = matId;
    return matId;
  };


  // ── 6. Recreate every targeted mesh, bound to the new material ─

  for (let pi = 0, plen = plan.length; pi < plen; pi++) {
    if ((pi & 0x3F) === 0) await step("Painting materials", pi, plen);
    const entry = plan[pi];
    const materialId = ensureMaterial(entry.ifcType);
    if (!materialId) {
      return {
        ok:    false,
        type:  SDKErrorType.InvalidOperation,
        error: `[applyIFCMaterials] Failed to create material for IFC type '${entry.ifcType}' on object '${entry.objId}'`,
      };
    }
    for (const snap of entry.meshSnaps) {
      // Skip meshes whose source geometry is no longer present (e.g.
      // pruned by an upstream pass).
      if (!sceneModel.geometries[snap.geometryId]) {
        continue;
      }
      // The painters need smooth normals to evaluate PBR shading
      // correctly. IFC-loaded geometry usually arrives without
      // them, so swap the recreated mesh to a sibling SceneGeometry
      // that does — `ensureGeometryAttribs` is a no-op when the
      // source already carries normals, and idempotent across
      // meshes that share a geometry (only one sibling is built per
      // unique source). The original geometry stays intact for any
      // mesh that wasn't part of this re-style pass.
      const augmentedGeomRes = ensureGeometryAttribs(sceneModel, snap.geometryId);
      const geometryId = augmentedGeomRes.ok ? augmentedGeomRes.value : snap.geometryId;
      const cr = sceneModel.createMesh({
        id:         snap.id,
        geometryId,
        materialId,
        matrix:     snap.matrix,
        opacity:    snap.opacity,
        color:      snap.color,
      });
      if (cr.ok === false) {
        return cr;
      }
      const ar = entry.sceneObj.addMesh(cr.value.id);
      if (ar.ok === false) {
        return ar;
      }
      if (snap.parentTransformId) {
        const lr = cr.value.setParentTransformId(snap.parentTransformId);
        if (lr.ok === false) {
          return lr;
        }
      }
    }
  }

  await step("Painting materials", plan.length, plan.length);
  return {ok: true, value: undefined};
}

