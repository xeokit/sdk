import {collapseAABB3, expandAABB3Points3, createAABB3Float32} from "../../base/math/boundaries";
import {compressRGBColors, octEncodeNormalsToU16, packUVsToFloat32, quantizePositions3} from "../../base/math/compression";
import {createVec3Float64} from "../../base/math/vector";
import {GaussianSplatsPrimitive, LinesPrimitive, PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../base/constants";
import {buildEdgeIndices} from "./buildEdgeIndices";
import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import type {SceneGeometryParams} from "./SceneGeometryParams";

const rtcCenter = createVec3Float64();

/**
 * Compresses a {@link SceneGeometryParams | SceneGeometryParams} into a {@link SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
 *
 * See {@link scene | @xeokit/sdk/model/scene}  for usage examples.
 *
 * @param geometryParams Uncompressed geometry params.
 * @returns Compressed geometry params.
 */
export function compressGeometryParams(geometryParams: SceneGeometryParams): SceneGeometryCompressedParams {


  // RTC disabled because there's no way to add a translation
  // to compensate for this offset in the mdeh modlng matrix.
  // const rtcNeeded = worldToRTCPositions(geometryParams.positions, geometryParams.positions, rtcCenter);
  const rtcNeeded = false;

  const aabb = collapseAABB3(createAABB3Float32());
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
  if (geometryParams.primitive === GaussianSplatsPrimitive) {
    // Splats: quantize centres + carry baked RGBA like points, plus the per-splat
    // scales/rotations (uncompressed in P1). Covariance is derived GPU-side.
    return {
      id: geometryParams.id,
      primitive: GaussianSplatsPrimitive,
      aabb,
      positionsCompressed,
      colorsCompressed: geometryParams.colorsCompressed ? geometryParams.colorsCompressed : (geometryParams.colors ? compressRGBColors(geometryParams.colors) : null),
      scales: geometryParams.scales,
      rotations: geometryParams.rotations,
      origin: rtcNeeded ? rtcCenter : null
    };
  }
  if (geometryParams.primitive === LinesPrimitive) {
    return {
      id: geometryParams.id,
      primitive: LinesPrimitive,
      aabb,
      positionsCompressed,
      colorsCompressed: geometryParams.colorsCompressed ? geometryParams.colorsCompressed : (geometryParams.colors ? compressRGBColors(geometryParams.colors) : undefined),
      indices: geometryParams.indices,
      origin: rtcNeeded ? rtcCenter : null
    };
  } else {
    // For triangle-family geometries, auto-build feature edges. The
    // builder returns an EMPTY typed array when every interior edge
    // is too smooth to count (typical of a single fully-coplanar
    // tessellation — e.g. an earcut'd 2D polygon at z=0, which is
    // common in drawing/SVG/PDF imports) AND every triangle's edge
    // is shared with a neighbour. Collapse that to `null` so
    // downstream consumers (specifically the WebGLRenderer's edge
    // portion allocator, which rejects size=0) see "no edges" as a
    // first-class state rather than an empty buffer to upload.
    let edgeIndices: ReturnType<typeof buildEdgeIndices> | null = null;
    if ((geometryParams.primitive === SolidPrimitive
      || geometryParams.primitive === SurfacePrimitive
      || geometryParams.primitive === TrianglesPrimitive) && geometryParams.indices) {
      const built = buildEdgeIndices(positionsCompressed, geometryParams.indices, aabb, 10);
      if (built && built.length > 0) edgeIndices = built;
    }
    // Encode normals only when supplied and length-matched against positions.
    const normalsCompressed =
      geometryParams.normals && geometryParams.normals.length === geometryParams.positions.length
        ? octEncodeNormalsToU16(geometryParams.normals)
        : undefined;
    // UVs ship to the GPU as RG32F so tiling values (UVs outside [0, 1])
    // survive intact — the shader applies fract() per-fragment before
    // sampling the atlas, which is what makes tiled materials work.
    // Mismatched lengths degrade to no-UVs rather than abort.
    const expectedUvLen = (geometryParams.positions.length / 3) * 2;
    const uvsCompressed =
      geometryParams.uvs && geometryParams.uvs.length === expectedUvLen
        ? packUVsToFloat32(geometryParams.uvs)
        : undefined;
    return { // Assume that closed triangle mesh is decomposed into open surfaces
      id: geometryParams.id,
      primitive: geometryParams.primitive,
      aabb,
      positionsCompressed,
      normalsCompressed,
      uvsCompressed,
      colorsCompressed: geometryParams.colorsCompressed ? geometryParams.colorsCompressed : (geometryParams.colors ? compressRGBColors(geometryParams.colors) : undefined),
      indices: geometryParams.indices,
      edgeIndices,
      origin: rtcNeeded ? rtcCenter : null
    };
  }
}
