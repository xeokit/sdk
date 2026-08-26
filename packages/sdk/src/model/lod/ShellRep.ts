import {SDKErrorType, type SDKResult} from "../../base/core";
import {TrianglesPrimitive} from "../../base/constants";
import type {
  SceneGeometry,
  SceneMaterial,
  SceneMesh,
  SceneObject,
  SceneRepParams
} from "../scene";
import {ShellGenerator} from "./ShellGenerator";
import type {ShellRepParams, ShellRepResult} from "./ShellRepParams";

/**
 * Creates a generated shell representation set in a SceneModel.
 *
 * This is the model-side utility used by viewing-layer impostor shell LOD. It
 * creates the shell geometry, mesh, object and representation set together so
 * the model itself declares that the source objects and shell object are
 * alternative representations of the same logical content.
 *
 * The shell follows the {@link ShellGeneratorResult} coordinate contract:
 * generated positions are relative to the generated center, and the shell mesh
 * is placed at that center.
 *
 * @param params Creation parameters.
 * @returns Created representation set and generated shell resources.
 *
 * @public
 */
export function createShellRep(params: ShellRepParams): SDKResult<ShellRepResult> {
  if (!params) {
    return error(SDKErrorType.InvalidInput, "[createShellRep] Missing required params.");
  }
  const model = params.model;
  if (!model || model.destroyed) {
    return error(SDKErrorType.InvalidInput, "[createShellRep] Expected a live SceneModel.");
  }
  if (!params.id) {
    return error(SDKErrorType.InvalidInput, "[createShellRep] Missing required representation set ID.");
  }
  if (model.repSets[params.id]) {
    return error(SDKErrorType.InvalidInput, `[createShellRep] SceneRepSet already exists: '${params.id}'.`);
  }
  if (!params.objectIds || params.objectIds.length === 0) {
    return error(SDKErrorType.InvalidInput, "[createShellRep] Expected at least one source object ID.");
  }

  const sourceObjects: SceneObject[] = [];
  for (let i = 0, len = params.objectIds.length; i < len; i++) {
    const objectId = params.objectIds[i];
    const object = model.objects[objectId];
    if (!object || object.destroyed) {
      return error(SDKErrorType.InvalidInput, `[createShellRep] Source SceneObject not found in SceneModel '${model.id}': '${objectId}'.`);
    }
    sourceObjects.push(object);
  }

  const generator = params.generator ?? new ShellGenerator();
  const shell = generator.generate(sourceObjects, params.generation ?? {});
  if (shell.indices.length === 0 || shell.positions.length === 0) {
    return error(SDKErrorType.InvalidInput, "[createShellRep] No shell triangles were generated.");
  }

  const shellGeometryId = params.shellGeometryId ?? `shellGeometry:${params.id}`;
  const shellMeshId = params.shellMeshId ?? `shellMesh:${params.id}`;
  const shellObjectId = params.shellObjectId ?? `shellObject:${params.id}`;
  const shellMaterialId = params.shellMaterialId ?? "shellMaterial";
  const shellColor = params.shellColor ?? [0.72, 0.76, 0.78];
  const shellOpacity = params.shellOpacity ?? 1;

  const geometryResult = model.createGeometry({
    id: shellGeometryId,
    primitive: TrianglesPrimitive,
    positions: shell.positions,
    indices: shell.indices
  });
  if (geometryResult.ok === false) {
    return geometryResult;
  }
  let geometry: SceneGeometry | null = geometryResult.value;
  let material: SceneMaterial | null = null;
  let mesh: SceneMesh | null = null;
  let object: SceneObject | null = null;

  const materialResult = ensureShellMaterial(model, shellMaterialId, shellColor, shellOpacity);
  if (materialResult.ok === false) {
    destroyCreated(geometry, mesh, object);
    return materialResult;
  }
  material = materialResult.value;

  const meshResult = model.createMesh({
    id: shellMeshId,
    geometryId: shellGeometryId,
    materialId: shellMaterialId,
    position: shell.center,
    color: shellColor,
    opacity: shellOpacity
  });
  if (meshResult.ok === false) {
    destroyCreated(geometry, mesh, object);
    return meshResult;
  }
  mesh = meshResult.value;

  const objectResult = model.createObject({
    id: shellObjectId,
    meshIds: [shellMeshId],
    originalSystemId: shellObjectId
  });
  if (objectResult.ok === false) {
    destroyCreated(geometry, mesh, object);
    return objectResult;
  }
  object = objectResult.value;

  const detailedRep: SceneRepParams = {
    id: params.detailedRepId ?? "detailed",
    objectIds: params.objectIds.slice()
  };
  if (params.detailedRange) {
    detailedRep.range = params.detailedRange;
  }
  const shellRep: SceneRepParams = {
    id: params.shellRepId ?? "shell",
    objectIds: [shellObjectId]
  };
  if (params.shellRange) {
    shellRep.range = params.shellRange;
  }

  const repSetResult = model.createRepSet({
    id: params.id,
    defaultRepId: detailedRep.id,
    selection: params.selection,
    reps: [detailedRep, shellRep]
  });
  if (repSetResult.ok === false) {
    destroyCreated(geometry, mesh, object);
    geometry = null;
    mesh = null;
    object = null;
    return repSetResult;
  }

  return {
    ok: true,
    value: {
      shell,
      repSet: repSetResult.value,
      geometry,
      mesh,
      object,
      material
    }
  };
}

function ensureShellMaterial(
  model: ShellRepParams["model"],
  id: string,
  color: ShellRepParams["shellColor"],
  opacity: number
): SDKResult<SceneMaterial> {
  const existing = model.materials[id];
  if (existing) {
    return {ok: true, value: existing};
  }
  return model.createMaterial({
    id,
    color,
    opacity
  });
}

function destroyCreated(
  geometry: SceneGeometry | null,
  mesh: SceneMesh | null,
  object: SceneObject | null
): void {
  if (object && !object.destroyed) {
    object.destroy();
  }
  if (mesh && !mesh.destroyed) {
    mesh.destroy();
  }
  if (geometry && !geometry.destroyed) {
    geometry.destroy();
  }
}

function error<T>(type: SDKErrorType, message: string): SDKResult<T> {
  return {ok: false, type, error: message};
}
