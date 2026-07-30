import {TrianglesPrimitive} from "../../../../base/constants";
import type {SceneMesh, SceneModelUpdateHint} from "../../../../model/scene";
import type {RenderContext} from "../RenderContext";
import type {TriangleGeometryStorageKind} from "../gpuMemoryManager/BatchGPUResources";
import {getConfiguredTriangleGeometryStorage} from "../TriangleGeometryRenderPathConfig";

/**
 * Chooses the triangle geometry representation for a renderer batch.
 *
 * This keeps the storage policy next to batching, while leaving
 * {@link MeshManager} focused on registration and batch lookup.
 */
export function selectTriangleGeometryStorage(
  renderContext: RenderContext,
  sceneMesh: SceneMesh
): TriangleGeometryStorageKind {
  if (sceneMesh.geometry.primitive !== TrianglesPrimitive) {
    return "dtx";
  }

  const configured = renderContext.memoryConfigs?.triangleGeometryStorage ?? "auto";
  if (configured === "dtx" || configured === "vbo") {
    return configured;
  }

  const hinted = getTriangleGeometryStorageForUpdateHint(sceneMesh.model?.updateHint);
  if (hinted) {
    return hinted;
  }

  return getConfiguredTriangleGeometryStorage(renderContext.activeView);
}

function getTriangleGeometryStorageForUpdateHint(
  updateHint: SceneModelUpdateHint | undefined
): TriangleGeometryStorageKind | null {
  switch (updateHint) {
    case "static":
      return "vbo";
    case "dynamic":
      return "dtx";
    default:
      return null;
  }
}
