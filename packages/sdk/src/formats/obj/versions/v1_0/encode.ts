import {createVec3Float64} from "../../../../math/vector";
import {
  createMat4Float64,
  mulMat4,
  transformPoint3
} from "../../../../math/matrix";
import {decompressPoint3WithAABB3} from "../../../../math/compression";
import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import {getMeshWorldMatrix} from "../../../../scene";
import {yieldToHost} from "../../../../utils";
import type {LoaderProgress} from "../../../LoaderProgress";

const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();

/**
 * Encodes a SceneModel as WaveFront OBJ text.
 *
 * Notes:
 * - Bakes each SceneMesh local matrix into vertex positions, since OBJ has no per-mesh transform concept.
 * - Does not perform any coordinate-system transforms.
 * - If a SceneMesh has a parent SceneTransform, applies the product of the mesh matrix and all ancestor
 *   SceneTransform matrices up the chain.
 * - Writes one OBJ object/group per SceneObject or SceneMesh.
 * - Links each mesh to a material expected to already exist in an accompanying MTL file.
 *
 * Supported options:
 * - options.mtlFileName: optional filename to emit in `mtllib`
 *
 * Material mapping:
 * - If sceneMesh.material exists, uses that material's ID
 * - Otherwise falls back to `mesh_<sceneMesh.id>`
 *
 * @private
 */
export async function encode(params: ModelEncodeParams, options?: any): Promise<string> {
  const {sceneModel} = params;
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

  const lines: string[] = [];
  let vertexOffset = 0;

  lines.push("# WaveFront OBJ");
  lines.push(`# SceneModel: ${sceneModel.id}`);

  if (opts.mtlFileName) {
    lines.push(`mtllib ${opts.mtlFileName}`);
  }

  lines.push("");

  const sceneObjects = Object.values(sceneModel.objects);

  for (let i = 0, len = sceneObjects.length; i < len; i++) {
    if ((i & 0x1F) === 0) await step("Encoding OBJ", i, len);
    const sceneObject = sceneObjects[i];
    const meshes = sceneObject.meshes || [];

    if (meshes.length === 0) {
      continue;
    }

    lines.push(`o ${sanitizeOBJName(sceneObject.id)}`);

    for (let j = 0, lenj = meshes.length; j < lenj; j++) {
      const sceneMesh = meshes[j];
      const geometry = sceneMesh.geometry;

      if (!geometry) {
        continue;
      }

      const objectName =
        meshes.length > 1
          ? `${sceneObject.id}_${sceneMesh.id}`
          : sceneObject.id;

      lines.push(`g ${sanitizeOBJName(objectName)}`);
      lines.push(`usemtl ${sanitizeMTLName(getMaterialNameForMesh(sceneMesh))}`);

      const positionsCompressed = geometry.positionsCompressed;
      const indices = geometry.indices;
      const aabb = geometry.aabb;

      if (!positionsCompressed || positionsCompressed.length === 0) {
        lines.push("");
        continue;
      }

      const matrix = getMeshWorldMatrix(sceneMesh);
      const numVerts = positionsCompressed.length / 3;

      for (let k = 0, lenk = positionsCompressed.length; k < lenk; k += 3) {
        tempVec3a[0] = positionsCompressed[k];
        tempVec3a[1] = positionsCompressed[k + 1];
        tempVec3a[2] = positionsCompressed[k + 2];

        decompressPoint3WithAABB3(tempVec3a, aabb, tempVec3b);
        transformPoint3(matrix, tempVec3b, tempVec3c);

        lines.push(`v ${formatNum(tempVec3c[0])} ${formatNum(tempVec3c[1])} ${formatNum(tempVec3c[2])}`);
      }

      if (indices && indices.length > 0) {
        for (let k = 0, lenk = indices.length; k < lenk; k += 3) {
          const a = indices[k] + 1 + vertexOffset;
          const b = indices[k + 1] + 1 + vertexOffset;
          const c = indices[k + 2] + 1 + vertexOffset;
          lines.push(`f ${a} ${b} ${c}`);
        }
      } else {
        // Assume non-indexed triangles
        for (let k = 0; k < numVerts; k += 3) {
          const a = vertexOffset + k + 1;
          const b = vertexOffset + k + 2;
          const c = vertexOffset + k + 3;
          lines.push(`f ${a} ${b} ${c}`);
        }
      }

      vertexOffset += numVerts;
      lines.push("");
    }
  }

  await step("Encoding OBJ", sceneObjects.length, sceneObjects.length);
  return lines.join("\n");
}

function getMaterialNameForMesh(sceneMesh: any): string {
  return sceneMesh.material?.id || `mesh_${sceneMesh.id}`;
}

function sanitizeOBJName(name: string): string {
  return String(name || "unnamed").replace(/\s+/g, "_");
}

function sanitizeMTLName(name: string): string {
  return String(name || "unnamed").replace(/\s+/g, "_");
}

function formatNum(value: number): string {
  if (!isFinite(value)) {
    return "0";
  }
  return Number(value.toFixed(9)).toString();
}
