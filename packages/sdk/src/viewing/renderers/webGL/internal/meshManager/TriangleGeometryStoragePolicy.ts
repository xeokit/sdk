import {TrianglesPrimitive} from "../../../../../base/constants";
import type {SceneMesh, SceneModelUpdateHint} from "../../../../../model/scene";
import type {TriangleGeometryStorageKind} from "../gpuMemoryManager/BatchGPUResources";

/**
 * Chooses the triangle geometry representation for a renderer batch.
 *
 * This keeps the storage policy next to batching, while leaving
 * {@link MeshManager} focused on registration and batch lookup.
 */
export function selectTriangleGeometryStorage(
  sceneMesh: SceneMesh
): TriangleGeometryStorageKind {
  if (sceneMesh.geometry.primitive !== TrianglesPrimitive) {
    return "dtx";
  }

  if (sceneMesh.billboard === "spherical") {
    return "dtx";
  }

  return getTriangleGeometryStorageForUpdateHint(sceneMesh.model?.updateHint);
}

function getTriangleGeometryStorageForUpdateHint(
  updateHint: SceneModelUpdateHint | undefined
): TriangleGeometryStorageKind {
  switch (updateHint) {
    case "static":
      return "vbo";
    case "dynamic":
      return "dtx";
    case "auto":
    default:
      return "dtx";
  }
}
