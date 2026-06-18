import {
  LinesPrimitive,
  PointsPrimitive,
  TrianglesPrimitive,
} from "../../../../../base/constants";
import {createMat4Float64, type Mat4} from "../../../../../base/math/matrix";
import type {Vec3} from "../../../../../base/math/vector";
import {yieldToHost} from "../../../../../base/utils";
import type {SceneModel} from "../../../../../model/scene";
import type {DataModel} from "../../../../../model/data";
import type {XKTData_v12} from "./XKTData_v12";

const MESH_ATTRIBUTES = 6; // RGB, opacity, metallic, roughness

/**
 * Decode an XKT v12 payload into a SceneModel (and optionally a DataModel).
 *
 * Geometry positions are 16-bit quantised. Geometry used by a single mesh is
 * decoded against its tile's decode matrix into tile-relative coordinates and
 * placed with the tile centre as the mesh RTC `origin`. Geometry shared by
 * several meshes (instanced) is decoded once against the shared
 * `reusedGeometriesDecodeMatrix` into a local frame, then each mesh places it
 * with its own matrix (plus the tile-centre origin). Each tile's coordinates
 * stay near its origin, so large/georeferenced models keep full precision.
 *
 * @private
 */
export async function xktToModel(params: {
  xktData: XKTData_v12,
  sceneModel?: SceneModel,
  dataModel?: DataModel,
  options: {layerId?: string; signal?: AbortSignal};
}): Promise<void> {

  const {xktData, sceneModel, dataModel, options} = params;
  const layerId = options?.layerId || "default";

  const {
    positions, colors, indices,
    matrices, reusedGeometriesDecodeMatrix,
    eachGeometryPrimitiveType,
    eachGeometryPositionsPortion,
    eachGeometryColorsPortion,
    eachGeometryIndicesPortion,
    eachMeshGeometriesPortion,
    eachMeshMatricesPortion,
    eachMeshMaterialAttributes,
    eachEntityId,
    eachEntityMeshesPortion,
    eachTileAABB,
    eachTileEntitiesPortion,
  } = xktData;

  const numGeometries = eachGeometryPrimitiveType.length;
  const numMeshes = eachMeshGeometriesPortion.length;
  const numEntities = eachEntityId.length;
  const numTiles = eachTileEntitiesPortion.length;

  if (dataModel) {
    buildDataModel(dataModel, xktData.metadata);
  }
  if (!sceneModel) {
    return;
  }

  // A geometry shared by more than one mesh is instanced; one used once is
  // baked into its tile's coordinate frame.
  const reuseCount = new Uint32Array(numGeometries);
  for (let i = 0; i < numMeshes; i++) reuseCount[eachMeshGeometriesPortion[i]]++;

  const geometryValid = new Map<number, boolean>();
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

    const lastEntityInTile = (tileIndex === numTiles - 1)
      ? numEntities - 1
      : eachTileEntitiesPortion[tileIndex + 1] - 1;

    for (let entityIndex = eachTileEntitiesPortion[tileIndex]; entityIndex <= lastEntityInTile; entityIndex++) {
      const lastMeshInEntity = (entityIndex === numEntities - 1)
        ? numMeshes - 1
        : eachEntityMeshesPortion[entityIndex + 1] - 1;

      const meshIds: string[] = [];

      for (let meshIndex = eachEntityMeshesPortion[entityIndex]; meshIndex <= lastMeshInEntity; meshIndex++) {
        const geometryIndex = eachMeshGeometriesPortion[meshIndex];
        const reused = reuseCount[geometryIndex] > 1;
        const primitive = scenePrimitive(eachGeometryPrimitiveType[geometryIndex]);
        if (primitive === undefined) continue;

        const geometryId = `geometry-${geometryIndex}`;
        let valid = geometryValid.get(geometryIndex);
        if (valid === undefined) {
          const decodeMatrix = reused ? reusedGeometriesDecodeMatrix : tileDecodeMatrix;
          const last = geometryIndex === numGeometries - 1;

          const posSlice = positions.subarray(
            eachGeometryPositionsPortion[geometryIndex],
            last ? positions.length : eachGeometryPositionsPortion[geometryIndex + 1],
          );
          const geometryParams: any = {
            id: geometryId,
            primitive,
            positions: decompressPositions(posSlice, decodeMatrix),
          };
          if (primitive === PointsPrimitive) {
            const colSlice = colors.subarray(
              eachGeometryColorsPortion[geometryIndex],
              last ? colors.length : eachGeometryColorsPortion[geometryIndex + 1],
            );
            if (colSlice.length > 0) geometryParams.colorsCompressed = colSlice;
          } else {
            const indSlice = indices.subarray(
              eachGeometryIndicesPortion[geometryIndex],
              last ? indices.length : eachGeometryIndicesPortion[geometryIndex + 1],
            );
            geometryParams.indices = eachGeometryPrimitiveType[geometryIndex] === 4
              ? lineStripToLines(indSlice)
              : indSlice;
            // XKT v12 stores no vertex normals, and its triangle geometry is
            // faceted (architectural). Leaving normals off lets the renderer
            // derive per-face flat normals — averaging shared-vertex normals
            // would smear shading across hard edges (patchy in lit modes).
          }
          // A degenerate geometry (no positions, or no indices for a primitive
          // that needs them) is rejected by createGeometry; skip it and the
          // meshes that reference it rather than emitting empty objects.
          const hasGeometry = geometryParams.positions.length > 0
            && (primitive === PointsPrimitive || (geometryParams.indices && geometryParams.indices.length > 0));
          valid = hasGeometry && sceneModel.createGeometry(geometryParams).ok !== false;
          geometryValid.set(geometryIndex, valid);
        }
        if (!valid) continue;

        const meshId = `mesh-${nextMeshId++}`;
        const attrBase = meshIndex * MESH_ATTRIBUTES;
        const meshParams: any = {
          id: meshId,
          geometryId,
          origin: tileCenter,
          color: [
            eachMeshMaterialAttributes[attrBase] / 255,
            eachMeshMaterialAttributes[attrBase + 1] / 255,
            eachMeshMaterialAttributes[attrBase + 2] / 255,
          ] as Vec3,
          opacity: eachMeshMaterialAttributes[attrBase + 3] / 255,
        };
        if (reused) {
          const matrixBase = eachMeshMatricesPortion[meshIndex];
          meshParams.matrix = createMat4Float64(
            Array.from(matrices.subarray(matrixBase, matrixBase + 16)) as unknown as Mat4,
          );
        }
        if (sceneModel.createMesh(meshParams).ok !== false) {
          meshIds.push(meshId);
        }
      }

      if (meshIds.length > 0) {
        sceneModel.createObject({id: eachEntityId[entityIndex], meshIds, layerId});
      }
    }
  }
}

/**
 * XKT primitive code → SceneModel primitive constant (undefined = skip).
 * XKT `solid` (closed) and `surface` (open) are both triangle meshes; the
 * renderer draws `TrianglesPrimitive`, so both map to it.
 */
function scenePrimitive(code: number): number | undefined {
  switch (code) {
    case 0: return TrianglesPrimitive; // solid
    case 1: return TrianglesPrimitive; // surface
    case 2: return PointsPrimitive;
    case 3: return LinesPrimitive;
    case 4: return LinesPrimitive; // line-strip, expanded to line pairs
    default: return undefined;     // 7 = text labels, etc.
  }
}

/** Decode matrix mapping a 16-bit quantised coordinate linearly across `aabb`. */
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

/** Dequantise positions through a diagonal-scale + translation decode matrix. */
function decompressPositions(compressed: Uint16Array, m: Mat4 | Float32Array): Float32Array {
  const out = new Float32Array(compressed.length);
  for (let i = 0, len = compressed.length; i < len; i += 3) {
    out[i] = compressed[i] * m[0] + m[12];
    out[i + 1] = compressed[i + 1] * m[5] + m[13];
    out[i + 2] = compressed[i + 2] * m[10] + m[14];
  }
  return out;
}

/** Expand a line-strip index list into discrete line-segment index pairs. */
function lineStripToLines(strip: Uint32Array): Uint32Array {
  if (strip.length < 2) return new Uint32Array(0);
  const lines = new Uint32Array((strip.length - 1) * 2);
  for (let i = 0, j = 0; i < strip.length - 1; i++) {
    lines[j++] = strip[i];
    lines[j++] = strip[i + 1];
  }
  return lines;
}

/**
 * Map XKT `metadata` to the DataModel: one DataObject per `metaObject`, parent
 * aggregation relationships, and property sets. SceneObjects share their ids
 * with these DataObjects, so the two describe the same entities.
 */
function buildDataModel(dataModel: DataModel, metadata: any): void {
  const propertySets = metadata?.propertySets || [];
  for (const ps of propertySets) {
    dataModel.createPropertySet({
      id: ps.id,
      name: ps.name || ps.id,
      type: ps.type || "Default",
      properties: (ps.properties || []).map((p: any) => ({name: p.name, value: p.value})),
    });
  }

  const metaObjects = metadata?.metaObjects || [];
  const objectIds = new Set<string>(metaObjects.map((mo: any) => mo.id));
  for (const mo of metaObjects) {
    dataModel.createObject({
      id: mo.id,
      name: mo.name ?? mo.id,
      type: mo.type ?? "Default",
      propertySetIds: mo.propertySetIds,
    });
  }
  for (const mo of metaObjects) {
    if (mo.parent && mo.parent !== mo.id && objectIds.has(mo.parent)) {
      dataModel.createRelationship({
        type: "BasicAggregation",
        relatingObjectId: mo.parent,
        relatedObjectId: mo.id,
      });
    }
  }
}
