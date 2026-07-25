import {TrianglesPrimitive} from "../../../../../base/constants";
import {createMat4Float64, mulMat4, translationMat4v, type Mat4} from "../../../../../base/math/matrix";
import type {Vec3} from "../../../../../base/math/vector";
import {yieldToHost} from "../../../../../base/utils";
import type {SceneModel} from "../../../../../model/scene";
import type {DataModel} from "../../../../../model/data";
import type {ModelParseParams} from "../../../../ModelParseParams";
import {splitElements} from "../shared/splitElements";
import {inflateBuffer, inflateString} from "../shared/inflateElements";

const MAX_GEOMETRY_POSITION_COMPONENTS = 1_350_000;
const MAX_GEOMETRY_VERTICES = Math.floor(MAX_GEOMETRY_POSITION_COMPONENTS / 3);

/**
 * Parse an XKT v6 binary (deflated, tiled, triangle primitives) into a
 * SceneModel. V6 predates the shared V7+ mesh table: it stores primitive
 * instances and one matrix per entity, so this version keeps a dedicated
 * builder instead of forcing the payload through the V7 shape.
 *
 * @private
 */
export async function parse(params: ModelParseParams, options: any = {}): Promise<void> {
  const {fileData, sceneModel, dataModel} = params;
  const e = splitElements(fileData);
  const xktData = {
    positions: new Uint16Array(inflateBuffer(e[0])),
    indices: new Uint32Array(inflateBuffer(e[2])),
    edgeIndices: new Uint32Array(inflateBuffer(e[3])),
    matrices: new Float32Array(inflateBuffer(e[4])),
    reusedPrimitivesDecodeMatrix: new Float32Array(inflateBuffer(e[5])),
    eachPrimitivePositionsPortion: new Uint32Array(inflateBuffer(e[6])),
    eachPrimitiveIndicesPortion: new Uint32Array(inflateBuffer(e[7])),
    eachPrimitiveEdgeIndicesPortion: new Uint32Array(inflateBuffer(e[8])),
    eachPrimitiveColorAndOpacity: new Uint8Array(inflateBuffer(e[9])),
    primitiveInstances: new Uint32Array(inflateBuffer(e[10])),
    eachEntityId: JSON.parse(inflateString(e[11])),
    eachEntityPrimitiveInstancesPortion: new Uint32Array(inflateBuffer(e[12])),
    eachEntityMatricesPortion: new Uint32Array(inflateBuffer(e[13])),
    eachTileAABB: new Float64Array(inflateBuffer(e[14])),
    eachTileEntitiesPortion: new Uint32Array(inflateBuffer(e[15])),
  };

  await buildV6SceneModel({xktData, sceneModel, dataModel, options});
}

async function buildV6SceneModel(params: {
  xktData: any;
  sceneModel?: SceneModel;
  dataModel?: DataModel;
  options: {idPrefix?: string; layerId?: string; signal?: AbortSignal};
}): Promise<void> {
  const {xktData, sceneModel, dataModel, options} = params;
  const layerId = options?.layerId || "default";
  const idPrefix = options?.idPrefix ? `${options.idPrefix}-` : "";

  if (!sceneModel) {
    return;
  }

  const {
    positions, indices, edgeIndices, matrices, reusedPrimitivesDecodeMatrix,
    eachPrimitivePositionsPortion, eachPrimitiveIndicesPortion, eachPrimitiveEdgeIndicesPortion,
    eachPrimitiveColorAndOpacity, primitiveInstances, eachEntityId,
    eachEntityPrimitiveInstancesPortion, eachEntityMatricesPortion,
    eachTileAABB, eachTileEntitiesPortion,
  } = xktData;

  const numPrimitives = eachPrimitivePositionsPortion.length;
  const numPrimitiveInstances = primitiveInstances.length;
  const numEntities = eachEntityId.length;
  const numTiles = eachTileEntitiesPortion.length;

  const primitiveReuseCounts = new Uint32Array(numPrimitives);
  for (let i = 0; i < numPrimitiveInstances; i++) {
    primitiveReuseCounts[primitiveInstances[i]]++;
  }

  const geometryParts = new Map<string, string[]>();
  let nextMeshId = 0;

  for (let tileIndex = 0; tileIndex < numTiles; tileIndex++) {
    if ((tileIndex & 0x07) === 0) await yieldToHost(options.signal);

    const aabbBase = tileIndex * 6;
    const tileCenter: Vec3 = [
      (eachTileAABB[aabbBase] + eachTileAABB[aabbBase + 3]) / 2,
      (eachTileAABB[aabbBase + 1] + eachTileAABB[aabbBase + 4]) / 2,
      (eachTileAABB[aabbBase + 2] + eachTileAABB[aabbBase + 5]) / 2,
    ];
    const rtcAABB = [
      eachTileAABB[aabbBase] - tileCenter[0],
      eachTileAABB[aabbBase + 1] - tileCenter[1],
      eachTileAABB[aabbBase + 2] - tileCenter[2],
      eachTileAABB[aabbBase + 3] - tileCenter[0],
      eachTileAABB[aabbBase + 4] - tileCenter[1],
      eachTileAABB[aabbBase + 5] - tileCenter[2],
    ];
    const tileDecodeMatrix = decodeMatrixFromAABB(rtcAABB);
    const tileMatrix = translationMat4v(tileCenter);

    const firstEntity = eachTileEntitiesPortion[tileIndex];
    const lastEntity = tileIndex === numTiles - 1
      ? numEntities - 1
      : eachTileEntitiesPortion[tileIndex + 1] - 1;

    for (let entityIndex = firstEntity; entityIndex <= lastEntity; entityIndex++) {
      const matrixBase = eachEntityMatricesPortion[entityIndex];
      const entityMatrix = matrixBase + 16 <= matrices.length
        ? createMat4Float64(Array.from(matrices.subarray(matrixBase, matrixBase + 16)) as unknown as Mat4)
        : undefined;
      const placementMatrix = entityMatrix
        ? mulMat4(tileMatrix, entityMatrix, createMat4Float64())
        : tileMatrix;
      const firstPrimitiveInstance = eachEntityPrimitiveInstancesPortion[entityIndex];
      const lastPrimitiveInstance = entityIndex === numEntities - 1
        ? primitiveInstances.length - 1
        : eachEntityPrimitiveInstancesPortion[entityIndex + 1] - 1;
      const meshIds: string[] = [];

      for (let primitiveInstanceIndex = firstPrimitiveInstance; primitiveInstanceIndex <= lastPrimitiveInstance; primitiveInstanceIndex++) {
        const primitiveIndex = primitiveInstances[primitiveInstanceIndex];
        const reused = primitiveReuseCounts[primitiveIndex] > 1;
        const geometryId = reused
          ? `${idPrefix}geometry-${tileIndex}-${primitiveIndex}`
          : `${idPrefix}geometry-${tileIndex}-${primitiveIndex}-${primitiveInstanceIndex}`;

        let partGeometryIds = geometryParts.get(geometryId);
        if (partGeometryIds === undefined) {
          const lastPrimitive = primitiveIndex === numPrimitives - 1;
          const posSlice = positions.subarray(
            eachPrimitivePositionsPortion[primitiveIndex],
            lastPrimitive ? positions.length : eachPrimitivePositionsPortion[primitiveIndex + 1],
          );
          const indexSlice = indices.subarray(
            eachPrimitiveIndicesPortion[primitiveIndex],
            lastPrimitive ? indices.length : eachPrimitiveIndicesPortion[primitiveIndex + 1],
          );
          const edgeIndexSlice = edgeIndices.subarray(
            eachPrimitiveEdgeIndicesPortion[primitiveIndex],
            lastPrimitive ? edgeIndices.length : eachPrimitiveEdgeIndicesPortion[primitiveIndex + 1],
          );
          const decodeMatrix = reused ? reusedPrimitivesDecodeMatrix : tileDecodeMatrix;
          partGeometryIds = createGeometryParts({
            sceneModel,
            baseGeometryId: geometryId,
            positions: decompressPositions(posSlice, decodeMatrix),
            indices: indexSlice,
            edgeIndices: edgeIndexSlice,
          });
          geometryParts.set(geometryId, partGeometryIds);
        }
        if (partGeometryIds.length === 0) continue;

        const colorBase = primitiveIndex * 4;
        for (const partGeometryId of partGeometryIds) {
          const meshId = `${idPrefix}mesh-${nextMeshId++}`;
          const meshParams: any = {
            id: meshId,
            geometryId: partGeometryId,
            matrix: placementMatrix,
            color: [
              eachPrimitiveColorAndOpacity[colorBase] / 255,
              eachPrimitiveColorAndOpacity[colorBase + 1] / 255,
              eachPrimitiveColorAndOpacity[colorBase + 2] / 255,
            ] as Vec3,
            opacity: eachPrimitiveColorAndOpacity[colorBase + 3] / 255,
          };
          if (sceneModel.createMesh(meshParams).ok !== false) {
            meshIds.push(meshId);
          }
        }
      }

      if (meshIds.length > 0) {
        const objectId = `${idPrefix}${eachEntityId[entityIndex]}`;
        sceneModel.createObject({id: objectId, meshIds, layerId});
        dataModel?.createObject({id: objectId, name: objectId, type: "Default"});
      }
    }
  }
}

function createGeometryParts(params: {
  sceneModel: SceneModel;
  baseGeometryId: string;
  positions: Float32Array;
  indices: Uint32Array;
  edgeIndices: Uint32Array;
}): string[] {
  const {sceneModel, baseGeometryId, positions, indices, edgeIndices} = params;
  if (positions.length === 0 || indices.length === 0) {
    return [];
  }
  if (positions.length <= MAX_GEOMETRY_POSITION_COMPONENTS) {
    const geometryParams: any = {
      id: baseGeometryId,
      primitive: TrianglesPrimitive,
      positions,
      indices,
    };
    if (edgeIndices.length > 0) {
      geometryParams.edgeIndices = edgeIndices;
    }
    return sceneModel.createGeometry(geometryParams).ok === false ? [] : [baseGeometryId];
  }

  const geometryIds: string[] = [];
  let remap = new Map<number, number>();
  let partPositions: number[] = [];
  let partIndices: number[] = [];
  let partIndex = 0;

  const flush = () => {
    if (partPositions.length === 0 || partIndices.length === 0) {
      return;
    }
    const id = `${baseGeometryId}-part-${partIndex++}`;
    const result = sceneModel.createGeometry({
      id,
      primitive: TrianglesPrimitive,
      positions: new Float32Array(partPositions),
      indices: new Uint32Array(partIndices),
    });
    if (result.ok !== false) {
      geometryIds.push(id);
    }
    remap = new Map<number, number>();
    partPositions = [];
    partIndices = [];
  };

  for (let i = 0, len = indices.length - (indices.length % 3); i < len; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    const needed = (remap.has(a) ? 0 : 1) + (remap.has(b) ? 0 : 1) + (remap.has(c) ? 0 : 1);
    if (partPositions.length > 0 && (partPositions.length / 3) + needed > MAX_GEOMETRY_VERTICES) {
      flush();
    }
    addIndex(a);
    addIndex(b);
    addIndex(c);
  }
  flush();

  return geometryIds;

  function addIndex(sourceIndex: number): void {
    let localIndex = remap.get(sourceIndex);
    if (localIndex === undefined) {
      const posBase = sourceIndex * 3;
      if (posBase + 2 >= positions.length) {
        return;
      }
      localIndex = partPositions.length / 3;
      remap.set(sourceIndex, localIndex);
      partPositions.push(positions[posBase], positions[posBase + 1], positions[posBase + 2]);
    }
    partIndices.push(localIndex);
  }
}

function decodeMatrixFromAABB(aabb: number[]): Mat4 {
  const m = createMat4Float64();
  m[0] = (aabb[3] - aabb[0]) / 65535;
  m[5] = (aabb[4] - aabb[1]) / 65535;
  m[10] = (aabb[5] - aabb[2]) / 65535;
  m[12] = aabb[0];
  m[13] = aabb[1];
  m[14] = aabb[2];
  return m;
}

function decompressPositions(compressed: Uint16Array, m: Mat4 | Float32Array): Float32Array {
  const out = new Float32Array(compressed.length);
  for (let i = 0, len = compressed.length; i < len; i += 3) {
    out[i] = compressed[i] * m[0] + m[12];
    out[i + 1] = compressed[i + 1] * m[5] + m[13];
    out[i + 2] = compressed[i + 2] * m[10] + m[14];
  }
  return out;
}
