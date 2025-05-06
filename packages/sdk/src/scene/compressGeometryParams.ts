import {collapseAABB3, expandAABB3Points3} from "../boundaries";
import {compressRGBColors, quantizePositions3} from "../compression";
import {createMat4, createVec3} from "../matrix";
import {LinesPrimitive, PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../constants";
import {buildEdgeIndices} from "./buildEdgeIndices";
import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import type {SceneGeometryParams} from "./SceneGeometryParams";

const rtcCenter = createVec3();

/**
 * Compresses a {@link SceneGeometryParams | SceneGeometryParams} into a {@link SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
 *
 * See {@link scene | @xeokit/sdk/scene}  for usage examples.
 *
 * @param geometryParams Uncompressed geometry params.
 * @returns Compressed geometry params.
 */
export function compressGeometryParams(geometryParams: SceneGeometryParams): SceneGeometryCompressedParams {


  // RTC disabled because there's no way to add a translation
  // to compensate for this offset in the mdeh modlng matrix.
  // const rtcNeeded = worldToRTCPositions(geometryParams.positions, geometryParams.positions, rtcCenter);
  const rtcNeeded = false;

  const aabb = collapseAABB3();
  expandAABB3Points3(aabb, geometryParams.positions);
  const positionsCompressed = quantizePositions3(geometryParams.positions, aabb);
  if (geometryParams.primitive === PointsPrimitive) {
    return {
      id: geometryParams.id,
      primitive: PointsPrimitive,
      aabb,
      uvsDecompressMatrix: undefined,
      positionsCompressed,
      colorsCompressed: geometryParams.colorsCompressed ? geometryParams.colorsCompressed : (geometryParams.colors ? compressRGBColors(geometryParams.colors) : null),
      origin: rtcNeeded ? rtcCenter : null
    };
  }
  if (geometryParams.primitive === LinesPrimitive) {
    return {
      id: geometryParams.id,
      primitive: LinesPrimitive,
      aabb,
      positionsCompressed,
      indices: geometryParams.indices,
      origin: rtcNeeded ? rtcCenter : null
    };
  } else {
    const edgeIndices = (geometryParams.primitive === SolidPrimitive
      || geometryParams.primitive === SurfacePrimitive
      || geometryParams.primitive === TrianglesPrimitive) && geometryParams.indices
      ? buildEdgeIndices(positionsCompressed, geometryParams.indices, aabb, 10)
      : null;
    return { // Assume that closed triangle mesh is decomposed into open surfaces
      id: geometryParams.id,
      primitive: geometryParams.primitive,
      aabb,
      positionsCompressed,
      indices: geometryParams.indices,
      edgeIndices,
      origin: rtcNeeded ? rtcCenter : null
    };
  }
}
