import type { ModelParser } from "../../../ModelParser";
import { TrianglesPrimitive } from "../../../../base/constants";
import { yieldToHost } from "../../../../base/utils";
import type { LoaderProgress } from "../../../LoaderProgress";

const SCHEMA = "IFC4";

/**
 * @private
 */
export const parse: ModelParser = async (params, options) => {
  const fileData = params.fileData;
  const opts = options || {};
  const onProgress: ((p: LoaderProgress) => void) | undefined = opts.onProgress;
  const signal: AbortSignal | undefined = opts.signal;
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

  if (params.sceneModel) {
    const meshes = fileData.meshes;
    if (meshes) {
      for (let i = 0, len = meshes.length; i < len; i++) {
        if ((i & 0x3F) === 0) await step("Parsing meshes", i, len);
        const mesh = meshes[i];
        const geometryRes = params.sceneModel.createGeometry({
          id: mesh.mesh_id,
          primitive: TrianglesPrimitive,
          positions: mesh.coordinates,
          indices: mesh.indices,
        });
        if (!geometryRes.ok) {
          // Error is logged via Scene.events.onError
        }
      }
    }
  }

  const elements = fileData.elements;
  if (elements) {
    for (let i = 0, len = elements.length; i < len; i++) {
      if ((i & 0x3F) === 0) await step("Building elements", i, len);
      const element = elements[i];
      const info = element.info;
      const objectId =
          element.guid !== undefined
              ? `${element.guid}`
              : info !== undefined && info.id !== undefined
                  ? info.id
                  : i;

      if (params.sceneModel) {
        const geometryId = element.mesh_id;
        const meshId = `${objectId}-mesh`;
        const vector = element.vector;
        const rotation = element.rotation;
        const color = element.color;

        const meshRes = params.sceneModel.createMesh({
          id: meshId,
          geometryId,
          color: color
              ? [color.r / 255.0, color.g / 255.0, color.b / 255.0]
              : undefined,
          opacity: color ? color.a / 255.0 : 1.0,
          quaternion: rotation
              ? [rotation.qx, rotation.qy, rotation.qz, rotation.qw]
              : undefined,
          position: [vector.x, vector.y, vector.z]
        });

        // Skip elements whose geometry is missing or invalid (a dangling
        // mesh_id, or a mesh whose createGeometry was rejected) rather than
        // aborting the whole model — one bad element shouldn't lose the rest.
        // (Matches the 1.1.0 parser.)
        if (meshRes.ok === false) {
          continue;
        }

        const sceneObjectRes = params.sceneModel.createObject({
          id: objectId,
          meshIds: [meshId],
        });

        if (sceneObjectRes.ok === false) {
          continue;
        }
      }

      if (params.dataModel) {
        if (!params.dataModel.objects[element.guid]) {
          const dataObjectRes = params.dataModel.createObject({
            id: objectId,
            type: element.type,
            schema: SCHEMA,
            name: info?.Name,
            description: info?.Description,
          });

          if (dataObjectRes.ok === false) {
            // Error is logged via Scene.events.onError; skip this element's
            // data object rather than failing the whole load.
          }
        }
      }
    }
  }

  if (onProgress) {
    progress.phase = "Building elements";
    progress.current = elements ? elements.length : 0;
    progress.total = elements ? elements.length : 0;
    onProgress(progress);
  }
};
