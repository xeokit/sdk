import {
  ClampToEdgeWrapping,
  GaussianSplatsPrimitive,
  GIFMediaType,
  JPEGMediaType,
  LinearFilter,
  LinearMipMapLinearFilter,
  LinearMipMapNearestFilter,
  LinesPrimitive,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipMapLinearFilter,
  NearestMipMapNearestFilter,
  PNGMediaType,
  PointsPrimitive,
  RepeatWrapping,
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive
} from "../../../../base/constants";
import type {SceneGeometryCompressedParams, SceneModel} from "../../../../model/scene";
import {createUUID, yieldToHost} from "../../../../base/utils";
import type {DataModel} from "../../../../model/data";
import type {Vec3} from "../../../../base/math/vector";
import type {XGFData_v3} from "./XGFData_v3";
import {createVec3Float32} from "../../../../base/math/vector";
import type {LoaderProgress} from "../../../LoaderProgress";

const NUM_MATERIAL_ATTRIBUTES = 4;
const NUM_MATERIAL_TEXTURE_REFS = 5;
const NUM_MATERIAL_PBR_BYTES = 8;
const NUM_TEXTURE_SAMPLER_BYTES = 5;
const NO_INDEX = 0xffffffff;

/** Inverse of the SAMPLER_CODE table in modelToXGF. */
const SAMPLER_DECODE: Record<number, number> = {
  1: RepeatWrapping,
  2: ClampToEdgeWrapping,
  3: MirroredRepeatWrapping,
  4: NearestFilter,
  5: LinearFilter,
  6: NearestMipMapNearestFilter,
  7: LinearMipMapNearestFilter,
  8: NearestMipMapLinearFilter,
  9: LinearMipMapLinearFilter
};

const MEDIA_TYPE_DECODE: Record<number, number> = {
  0: PNGMediaType,
  1: JPEGMediaType,
  2: GIFMediaType
};

const ALPHA_MODE_NAMES: Array<"OPAQUE" | "MASK" | "BLEND"> = ["OPAQUE", "MASK", "BLEND"];

/**
 * Decode an XGF v3 payload into a SceneModel (and optionally a DataModel).
 *
 * Async because texture decoding goes through `createImageBitmap()` for
 * the standard PNG/JPEG/GIF cases. Textures with the opaque
 * media-type (already-compressed buffers) skip decoding and pass the
 * raw bytes through as a SceneTexture buffer.
 *
 * @private
 */
export async function xgfToModel(params: {
  xgfData: XGFData_v3,
  sceneModel?: SceneModel,
  dataModel?: DataModel,
  options: {
    layerId?: string;
    signal?: AbortSignal;
    onProgress?: (p: LoaderProgress) => void;
  }
}): Promise<void> {

  const {xgfData, sceneModel, dataModel, options} = params;
  const layerId = options?.layerId || "default";
  const defaultId = sceneModel ? sceneModel.id : createUUID();

  // Reusable progress payload — mutated and re-emitted to keep
  // per-yield allocations to zero. The signal is checked inside
  // yieldToHost itself, so a cancelled load aborts within ≈one
  // yield interval (≈16 ms).
  const progress: LoaderProgress = {phase: "", current: 0, total: 0};
  const step = async (phase: string, current: number, total: number): Promise<void> => {
    if (options.onProgress) {
      progress.phase = phase;
      progress.current = current;
      progress.total = total;
      options.onProgress(progress);
    }
    await yieldToHost(options.signal);
  };

  if (dataModel) {
    dataModel.createObject({
      id: defaultId,
      name: defaultId,
      type: "BasicEntity"
    });
  }

  const {
    positions, colors, indices, edgeIndices, aabbs,
    normals, uvs, scales, rotations,
    eachGeometryPositionsBase,
    eachGeometryColorsBase,
    eachGeometryIndicesBase,
    eachGeometryEdgeIndicesBase,
    eachGeometryNormalsBase,
    eachGeometryUVsBase,
    eachGeometryScalesBase,
    eachGeometryRotationsBase,
    eachGeometryAABBBase,
    eachGeometryPrimitiveType,
    matrices,
    textureData,
    eachTextureDataBase,
    eachTextureMediaType,
    eachTextureWidth,
    eachTextureHeight,
    eachTextureSampler,
    eachTextureId,
    eachMaterialPBR,
    eachMaterialTextures,
    eachMaterialId,
    eachMeshGeometriesBase,
    eachMeshMatricesBase,
    eachMeshMaterialAttributes,
    eachMeshMaterial,
    eachObjectId,
    eachObjectMeshesBase
  } = xgfData;

  const numGeometries = eachGeometryPositionsBase.length;
  const numMeshes     = eachMeshGeometriesBase.length;
  const numObjects    = eachObjectMeshesBase.length;
  const numTextures   = eachTextureDataBase.length;
  const numMaterials  = eachMaterialId.length;

  // ── Decode textures up-front ───────────────────────────────────────
  // Textures need to exist before materials can reference them.
  const createdTextureIds: string[] = [];
  if (sceneModel) {
    // Decode in small concurrent chunks: createImageBitmap runs off the main
    // thread, so issuing several at once lets the browser decode them in
    // parallel instead of one-at-a-time. Chunked rather than all-at-once to
    // bound peak decoded-image memory — a decoded 4K RGBA bitmap is ~64 MB, so
    // only a handful are ever held in flight.
    const DECODE_CHUNK = 4;

    const sliceFor = (i: number) => textureData.subarray(
      eachTextureDataBase[i],
      (i === numTextures - 1) ? textureData.length : eachTextureDataBase[i + 1]);

    const samplerParamsFor = (i: number) => {
      const sBase = i * NUM_TEXTURE_SAMPLER_BYTES;
      return {
        minFilter: SAMPLER_DECODE[eachTextureSampler[sBase]]     || LinearMipMapLinearFilter,
        magFilter: SAMPLER_DECODE[eachTextureSampler[sBase + 1]] || LinearFilter,
        wrapS:     SAMPLER_DECODE[eachTextureSampler[sBase + 2]] || RepeatWrapping,
        wrapT:     SAMPLER_DECODE[eachTextureSampler[sBase + 3]] || RepeatWrapping,
        wrapR:     SAMPLER_DECODE[eachTextureSampler[sBase + 4]] || RepeatWrapping,
        width:  eachTextureWidth[i],
        height: eachTextureHeight[i]
      } as any;
    };

    for (let chunkStart = 0; chunkStart < numTextures; chunkStart += DECODE_CHUNK) {
      await step("Decoding textures", chunkStart, numTextures);
      const chunkEnd = Math.min(chunkStart + DECODE_CHUNK, numTextures);

      // Issue every decodable texture in this chunk concurrently.
      const decoding: Array<Promise<ImageBitmap> | null> = [];
      for (let i = chunkStart; i < chunkEnd; i++) {
        const bytes = sliceFor(i);
        const standardMedia = MEDIA_TYPE_DECODE[eachTextureMediaType[i]];
        if (bytes.length > 0 && standardMedia !== undefined) {
          const blob = new Blob([bytes], {
            type: standardMedia === PNGMediaType ? "image/png"
                : standardMedia === JPEGMediaType ? "image/jpeg"
                : "image/gif"
          });
          decoding.push(createImageBitmap(blob));
        } else {
          decoding.push(null);
        }
      }
      const bitmaps = await Promise.all(decoding.map(p => p ?? Promise.resolve(null)));

      // Register the chunk's textures in index order (materials reference by id).
      for (let i = chunkStart; i < chunkEnd; i++) {
        const id = eachTextureId[i] || `texture-${i}`;
        createdTextureIds.push(id);
        const samplerParams = samplerParamsFor(i);
        const bytes = sliceFor(i);
        const bitmap = bitmaps[i - chunkStart];

        if (bytes.length === 0) {
          // Empty placeholder — register a 1×1 white pixel so material
          // lookups don't fail. The mesh just won't show this texture.
          const onePx = new Uint8ClampedArray([255, 255, 255, 255]);
          const imageData = (typeof ImageData !== "undefined")
            ? new ImageData(onePx, 1, 1)
            : { data: onePx, width: 1, height: 1 };
          sceneModel.createTexture({
            id, imageData, mediaType: PNGMediaType,
            ...samplerParams, width: 1, height: 1, flipY: false
          });
        } else if (bitmap) {
          // PNG/JPEG/GIF — decoded ImageBitmap the GPU atlas samples directly.
          sceneModel.createTexture({
            id, image: bitmap, mediaType: MEDIA_TYPE_DECODE[eachTextureMediaType[i]],
            ...samplerParams, width: bitmap.width, height: bitmap.height, flipY: false
          });
        } else {
          // Opaque/transcoded — pass the bytes through as a SceneTexture
          // buffer; the runtime/transcoder pipeline handles upload.
          sceneModel.createTexture({
            id,
            buffers: [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)],
            ...samplerParams, flipY: false, compressed: true
          });
        }
      }
    }
  }

  // ── Materials ──────────────────────────────────────────────────────
  if (sceneModel) {
    for (let i = 0; i < numMaterials; i++) {
      if ((i & 0x3F) === 0) await step("Building materials", i, numMaterials);
      const id = eachMaterialId[i];
      const base = i * NUM_MATERIAL_PBR_BYTES;
      const tBase = i * NUM_MATERIAL_TEXTURE_REFS;
      const params: any = {
        id,
        color: [
          eachMaterialPBR[base]     / 255,
          eachMaterialPBR[base + 1] / 255,
          eachMaterialPBR[base + 2] / 255
        ] as Vec3,
        opacity:     eachMaterialPBR[base + 3] / 255,
        roughness:   eachMaterialPBR[base + 4] / 255,
        metallic:    eachMaterialPBR[base + 5] / 255,
        alphaMode:   ALPHA_MODE_NAMES[eachMaterialPBR[base + 6]] || "OPAQUE",
        alphaCutoff: eachMaterialPBR[base + 7] / 255
      };
      const colorIdx     = eachMaterialTextures[tBase];
      const mrIdx        = eachMaterialTextures[tBase + 1];
      const normalsIdx   = eachMaterialTextures[tBase + 2];
      const occlusionIdx = eachMaterialTextures[tBase + 3];
      const emissiveIdx  = eachMaterialTextures[tBase + 4];
      if (colorIdx     >= 0) params.colorTextureId             = createdTextureIds[colorIdx];
      if (mrIdx        >= 0) params.metallicRoughnessTextureId = createdTextureIds[mrIdx];
      if (normalsIdx   >= 0) params.normalsTextureId           = createdTextureIds[normalsIdx];
      if (occlusionIdx >= 0) params.occlusionTextureId         = createdTextureIds[occlusionIdx];
      if (emissiveIdx  >= 0) params.emissiveTextureId          = createdTextureIds[emissiveIdx];
      sceneModel.createMaterial(params);
    }
  }

  // ── Geometries / meshes / objects ──────────────────────────────────
  let nextMeshId = 0;
  const floatColor = createVec3Float32();

  for (let objectIdx = 0; objectIdx < numObjects; objectIdx++) {
    if ((objectIdx & 0x1F) === 0) {
      // Step every 32 objects — geometry building is the
      // heaviest phase but each individual object is fast, so
      // we don't need a per-object yield. 32-object cadence is
      // dense enough for smooth bar updates on big models.
      await step("Building meshes", objectIdx, numObjects);
    }
    const objectId = eachObjectId[objectIdx];
    const atLastObject = (objectIdx === numObjects - 1);
    const firstMeshIdx = eachObjectMeshesBase[objectIdx];
    const lastMeshIdx  = atLastObject ? (numMeshes - 1) : (eachObjectMeshesBase[objectIdx + 1] - 1);
    const meshIds: string[] = [];

    for (let meshIdx = firstMeshIdx; meshIdx <= lastMeshIdx; meshIdx++) {
      const meshId = `${nextMeshId++}`;
      if (sceneModel) {
        const geometryIdx = eachMeshGeometriesBase[meshIdx];
        const geometryId  = `${geometryIdx}`;

        if (!sceneModel.geometries[geometryId]) {
          const params: any = {id: geometryId};
          switch (eachGeometryPrimitiveType[geometryIdx]) {
            case 0: params.primitive = TrianglesPrimitive; break;
            case 1: params.primitive = SolidPrimitive;     break;
            case 2: params.primitive = SurfacePrimitive;   break;
            case 3: params.primitive = LinesPrimitive;     break;
            case 4: params.primitive = PointsPrimitive;    break;
            case 5: params.primitive = GaussianSplatsPrimitive; break;
          }
          const aabbsBase = eachGeometryAABBBase[geometryIdx];
          params.aabb = aabbs.subarray(aabbsBase, aabbsBase + 6);

          const atLastGeometry = (geometryIdx === numGeometries - 1);
          const posStart   = eachGeometryPositionsBase[geometryIdx];
          const posEnd     = atLastGeometry ? positions.length    : eachGeometryPositionsBase[geometryIdx + 1];
          const indStart   = eachGeometryIndicesBase[geometryIdx];
          const indEnd     = atLastGeometry ? indices.length      : eachGeometryIndicesBase[geometryIdx + 1];
          const edgeStart  = eachGeometryEdgeIndicesBase[geometryIdx];
          const edgeEnd    = atLastGeometry ? edgeIndices.length  : eachGeometryEdgeIndicesBase[geometryIdx + 1];

          params.positionsCompressed = positions.subarray(posStart, posEnd);
          if (params.primitive !== PointsPrimitive && params.primitive !== GaussianSplatsPrimitive) {
            params.indices = indices.subarray(indStart, indEnd);
          }
          const edgeSlice = edgeIndices.subarray(edgeStart, edgeEnd);
          if (edgeSlice.length > 0) params.edgeIndices = edgeSlice;

          // Per-vertex RGBA colours (dense-cumulative base, like positions).
          // Essential for splats, whose baked colour lives here; also restores
          // per-vertex colours for any other primitive that carries them.
          const colStart = eachGeometryColorsBase[geometryIdx];
          const colEnd   = atLastGeometry ? colors.length : eachGeometryColorsBase[geometryIdx + 1];
          const colSlice = colors.subarray(colStart, colEnd);
          if (colSlice.length > 0) params.colorsCompressed = colSlice;

          // Find each per-vertex array's slice. Walk forward to the
          // next geometry that *has* normals/UVs to determine the end —
          // since geometries without normals/UVs are sparse, we can't
          // just look at the next entry.
          const normalsBaseI = eachGeometryNormalsBase[geometryIdx];
          if (normalsBaseI !== NO_INDEX) {
            const normalsEnd = nextNonSentinelBase(eachGeometryNormalsBase, geometryIdx, normals.length);
            params.normalsCompressed = normals.subarray(normalsBaseI, normalsEnd);
          }
          const uvsBaseI = eachGeometryUVsBase[geometryIdx];
          if (uvsBaseI !== NO_INDEX) {
            const uvsEnd = nextNonSentinelBase(eachGeometryUVsBase, geometryIdx, uvs.length);
            params.uvsCompressed = uvs.subarray(uvsBaseI, uvsEnd);
          }

          // Gaussian-splat geometries carry per-splat scales + rotations. Scales
          // pass through as floats; rotation bytes are dequantised back to the
          // xyzw floats SceneGeometry stores ((b - 128) / 128, the .splat decode).
          const scalesBaseI = eachGeometryScalesBase[geometryIdx];
          if (scalesBaseI !== NO_INDEX) {
            const scalesEnd = nextNonSentinelBase(eachGeometryScalesBase, geometryIdx, scales.length);
            params.scales = scales.subarray(scalesBaseI, scalesEnd);
          }
          const rotationsBaseI = eachGeometryRotationsBase[geometryIdx];
          if (rotationsBaseI !== NO_INDEX) {
            const rotationsEnd = nextNonSentinelBase(eachGeometryRotationsBase, geometryIdx, rotations.length);
            const decoded = new Float32Array(rotationsEnd - rotationsBaseI);
            for (let i = 0; i < decoded.length; i++) {
              decoded[i] = (rotations[rotationsBaseI + i] - 128) / 128;
            }
            params.rotations = decoded;
          }
          sceneModel.createGeometryCompressed(params as SceneGeometryCompressedParams);
        }

        const matricesBase = eachMeshMatricesBase[meshIdx];
        const matrix = matrices.subarray(matricesBase, matricesBase + 16);
        const meshParams: any = { id: meshId, geometryId, matrix };

        const materialIdx = eachMeshMaterial[meshIdx];
        if (materialIdx >= 0 && materialIdx < numMaterials) {
          meshParams.materialId = eachMaterialId[materialIdx];
        } else {
          // Inline RGBA fallback — same form as v1.
          const colorBase = meshIdx * NUM_MATERIAL_ATTRIBUTES;
          floatColor[0] = eachMeshMaterialAttributes[colorBase]     / 255;
          floatColor[1] = eachMeshMaterialAttributes[colorBase + 1] / 255;
          floatColor[2] = eachMeshMaterialAttributes[colorBase + 2] / 255;
          meshParams.color   = floatColor.slice(0, 3) as unknown as Vec3;
          meshParams.opacity = eachMeshMaterialAttributes[colorBase + 3] / 255;
        }
        sceneModel.createMesh(meshParams);
      }
      meshIds.push(meshId);
    }

    if (meshIds.length > 0) {
      if (sceneModel) {
        sceneModel.createObject({ id: objectId, meshIds, layerId });
      }
      if (dataModel) {
        dataModel.createObject({ id: objectId, name: objectId, type: "BasicEntity" });
        dataModel.createRelationship({
          type: "BasicAggregation",
          relatingObjectId: defaultId,
          relatedObjectId: objectId
        });
      }
    }
  }

  // Final emit so the progress bar reads as 100% before the
  // promise resolves, regardless of which loop was last.
  if (options.onProgress) {
    progress.phase = "Building meshes";
    progress.current = numObjects;
    progress.total = numObjects;
    options.onProgress(progress);
  }
}

/**
 * Walks forward from `startIdx + 1` looking for the next geometry whose
 * base into the per-vertex array isn't the NO_INDEX sentinel. That base
 * is the end of the slice for `startIdx`. If no later geometry has
 * data, the slice runs to `arrayLength`.
 */
function nextNonSentinelBase(bases: Uint32Array<any>, startIdx: number, arrayLength: number): number {
  for (let i = startIdx + 1; i < bases.length; i++) {
    if (bases[i] !== NO_INDEX) return bases[i];
  }
  return arrayLength;
}
