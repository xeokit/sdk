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
import {createCoordinateSystemTransform} from "../../../../model/scene";
import {createMat4Float64, mulMat4} from "../../../../base/math/matrix";
import {createUUID, yieldToHost} from "../../../../base/utils";
import type {DataModel} from "../../../../model/data";
import type {Vec3} from "../../../../base/math/vector";
import type {XGFData_v2} from "./XGFData_v2";
import {createVec3Float32} from "../../../../base/math/vector";
import type {LoaderProgress} from "../../../LoaderProgress";
import {SDKErrorType} from "../../../../base/core";

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

interface XGFCreatedIdsCollector {
  objects: string[];
  meshes: string[];
  transforms: string[];
  geometries: string[];
  materials: string[];
  textures: string[];
  error?: string;
}

/**
 * Decode an XGF v2 payload into a SceneModel (and optionally a DataModel).
 *
 * Async because texture decoding goes through `createImageBitmap()` for
 * the standard PNG/JPEG/GIF cases. Textures with the opaque
 * media-type (already-compressed buffers) skip decoding and pass the
 * raw bytes through as a SceneTexture buffer.
 *
 * @private
 */
export async function xgfToModel(params: {
  xgfData: XGFData_v2,
  sceneModel?: SceneModel,
  dataModel?: DataModel,
  options: {
    layerId?: string;
    /** @private Used by manifest streaming to avoid asset ID collisions across stream namespaces. */
    idPrefix?: string;
    /** @private Used by recursive stream loading to translate substream content. */
    origin?: number[];
    /** @private Used by recursive stream loading to orient substream content. */
    coordinateSystem?: any;
    /** @private Used by manifest streaming to avoid mesh ID collisions across chunks. */
    meshIdPrefix?: string;
    /** @private Used by manifest streaming to track chunk ownership without whole-model diffs. */
    createdIds?: XGFCreatedIdsCollector;
    signal?: AbortSignal;
    onProgress?: (p: LoaderProgress) => void;
  }
}): Promise<void> {

  const {xgfData, sceneModel, dataModel, options} = params;
  const layerId = options?.layerId || "default";
  const idPrefix = options?.idPrefix || "";
  const origin = options?.origin;
  const coordinateSystemMatrix = sceneModel && options?.coordinateSystem
    ? createCoordinateSystemTransform(options.coordinateSystem, sceneModel.coordinateSystem, createMat4Float64())
    : undefined;
  const meshIdPrefix = options?.meshIdPrefix;
  const createdIds = options?.createdIds;
  const defaultId = sceneModel ? sceneModel.id : createUUID();
  const prefixId = (id: string): string => id && idPrefix ? `${idPrefix}${id}` : id;
  const transformMatrix = (matrix: any, apply: boolean): any => {
    if (!apply) {
      return matrix;
    }
    const hasOrigin = !!origin && (origin[0] !== 0 || origin[1] !== 0 || origin[2] !== 0);
    if (!coordinateSystemMatrix && !hasOrigin) {
      return matrix;
    }
    const transformed = coordinateSystemMatrix
      ? mulMat4(coordinateSystemMatrix, matrix, createMat4Float64())
      : (matrix.slice ? matrix.slice() : Array.from(matrix));
    if (hasOrigin) {
      transformed[12] += origin![0];
      transformed[13] += origin![1];
      transformed[14] += origin![2];
    }
    return transformed;
  };
  const fail = (message: string): false => {
    if (createdIds) {
      createdIds.error = message;
    }
    sceneModel?.scene.logError({
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: message
    });
    return false;
  };

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
    eachTextureEncoding,
    eachTextureId,
    eachMaterialPBR,
    eachMaterialColor,
    eachMaterialTextures,
    eachMaterialId,
    eachMaterialTriplanarScale,
    eachMeshGeometriesBase,
    eachMeshMatricesBase,
    eachMeshMaterialAttributes,
    eachMeshMaterial,
    eachObjectId,
    eachObjectMeshesBase
  } = xgfData;
  const eachGeometryId = (xgfData as any).eachGeometryId as string[] | undefined;
  const eachMeshGeometryId = (xgfData as any).eachMeshGeometryId as string[] | undefined;
  const eachMeshMaterialId = (xgfData as any).eachMeshMaterialId as string[] | undefined;
  const eachTransformId = (xgfData as any).eachTransformId as string[] | undefined;
  const eachTransformParentId = (xgfData as any).eachTransformParentId as string[] | undefined;
  const eachTransformMatricesBase = (xgfData as any).eachTransformMatricesBase as Uint32Array<any> | undefined;
  const eachMeshParentTransformId = (xgfData as any).eachMeshParentTransformId as string[] | undefined;

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

    // `createImageBitmap` is browser-only; in Node/headless (e.g. the convert
    // CLI) it's undefined. Guard it so textured models still load — undecoded
    // standard images pass through as encoded bytes (see below) rather than
    // throwing and aborting the whole load.
    const canDecode = typeof createImageBitmap === "function" && typeof Blob !== "undefined";

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
          // Fall back to a null bitmap (pass-through bytes) when decoding is
          // unavailable or fails, so the load never throws over a texture.
          decoding.push(canDecode ? createImageBitmap(blob).catch(() => null) : null);
        } else {
          decoding.push(null);
        }
      }
      const bitmaps = await Promise.all(decoding.map(p => p ?? Promise.resolve(null)));

      // Register the chunk's textures in index order (materials reference by id).
      for (let i = chunkStart; i < chunkEnd; i++) {
        const id = prefixId(eachTextureId[i] || `texture-${i}`);
        createdTextureIds.push(id);
        if (sceneModel.textures[id]) {
          continue;
        }
        const samplerParams = samplerParamsFor(i);
        const bytes = sliceFor(i);
        const bitmap = bitmaps[i - chunkStart];
        const standardMedia = MEDIA_TYPE_DECODE[eachTextureMediaType[i]];

        let textureResult: any;
        if (bytes.length === 0) {
          // Empty placeholder — register a 1×1 white pixel so material
          // lookups don't fail. The mesh just won't show this texture.
          const onePx = new Uint8ClampedArray([255, 255, 255, 255]);
          const imageData = (typeof ImageData !== "undefined")
            ? new ImageData(onePx, 1, 1)
            : { data: onePx, width: 1, height: 1 };
          textureResult = sceneModel.createTexture({
            id, imageData, mediaType: PNGMediaType,
            encoding: eachTextureEncoding[i], ...samplerParams, width: 1, height: 1, flipY: false
          });
        } else if (bitmap) {
          // PNG/JPEG/GIF — decoded ImageBitmap the GPU atlas samples directly.
          textureResult = sceneModel.createTexture({
            id, image: bitmap, mediaType: MEDIA_TYPE_DECODE[eachTextureMediaType[i]],
            encoding: eachTextureEncoding[i], ...samplerParams, width: bitmap.width, height: bitmap.height, flipY: false
          });
        } else if (standardMedia !== undefined) {
          // Standard image (PNG/JPEG/GIF) we couldn't decode in this
          // environment (no createImageBitmap, or decode failed). Pass the
          // encoded bytes through WITH their media type so the texture
          // round-trips losslessly and a browser decodes it on load. (Not
          // `compressed` — it isn't GPU-compressed.)
          textureResult = sceneModel.createTexture({
            id,
            buffers: [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)],
            mediaType: standardMedia,
            encoding: eachTextureEncoding[i], ...samplerParams, flipY: false
          });
        } else {
          // Opaque/transcoded (KTX2/Basis) — pass the bytes through as a
          // compressed SceneTexture buffer; the transcoder handles upload.
          textureResult = sceneModel.createTexture({
            id,
            buffers: [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)],
            encoding: eachTextureEncoding[i], ...samplerParams, flipY: false, compressed: true
          });
        }
        if (textureResult && textureResult.ok === false) {
          fail(textureResult.error);
          return;
        }
        createdIds?.textures.push(id);
      }
    }
  }

  // ── Materials ──────────────────────────────────────────────────────
  if (sceneModel) {
    for (let i = 0; i < numMaterials; i++) {
      if ((i & 0x3F) === 0) await step("Building materials", i, numMaterials);
      const id = prefixId(eachMaterialId[i]);
      if (sceneModel.materials[id]) {
        continue;
      }
      const base = i * NUM_MATERIAL_PBR_BYTES;
      const tBase = i * NUM_MATERIAL_TEXTURE_REFS;
      const params: any = {
        id,
        color: [
          eachMaterialColor[i * 3],
          eachMaterialColor[i * 3 + 1],
          eachMaterialColor[i * 3 + 2]
        ] as Vec3,
        opacity:     eachMaterialPBR[base + 3] / 255,
        roughness:   eachMaterialPBR[base + 4] / 255,
        metallic:    eachMaterialPBR[base + 5] / 255,
        alphaMode:   ALPHA_MODE_NAMES[eachMaterialPBR[base + 6]] || "OPAQUE",
        alphaCutoff: eachMaterialPBR[base + 7] / 255,
        triplanarScale: eachMaterialTriplanarScale[i]
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
      const materialResult = sceneModel.createMaterial(params);
      if (materialResult && materialResult.ok === false) {
        fail(materialResult.error);
        return;
      }
      createdIds?.materials.push(id);
    }
  }

  // ── Transforms -----------───────────────────────────────────────────
  if (sceneModel && eachTransformId && eachTransformMatricesBase && (sceneModel as any).transforms && typeof (sceneModel as any).createTransform === "function") {
    for (let i = 0; i < eachTransformId.length; i++) {
      const id = prefixId(eachTransformId[i]);
      if (!id || (sceneModel as any).transforms[id]) continue;
      const matricesBase = eachTransformMatricesBase[i];
      const parentId = eachTransformParentId?.[i] || "";
      const transformResult = sceneModel.createTransform({
        id,
        matrix: transformMatrix(matrices.subarray(matricesBase, matricesBase + 16), !parentId) as any
      });
      if (transformResult && transformResult.ok === false) {
        fail(transformResult.error);
        return;
      }
      createdIds?.transforms.push(id);
    }
    if (eachTransformParentId) {
      for (let i = 0; i < eachTransformId.length; i++) {
        const id = prefixId(eachTransformId[i]);
        const parentId = prefixId(eachTransformParentId[i]);
        if (!id || !parentId) continue;
        const transform = (sceneModel as any).transforms[id];
        if (!transform) {
          fail(`[xgf] Transform '${id}' not found while assigning parent '${parentId}'`);
          return;
        }
        const parentResult = transform.setParentTransformId(parentId);
        if (parentResult && parentResult.ok === false) {
          fail(parentResult.error);
          return;
        }
      }
    }
  }

  // ── Geometries / meshes / objects ──────────────────────────────────
  let nextMeshId = sceneModel && !meshIdPrefix ? nextAvailableNumericMeshId(sceneModel) : 0;
  const floatColor = createVec3Float32();
  const createLocalGeometry = (geometryIdx: number, geometryId: string): boolean => {
    if (!sceneModel || sceneModel.geometries[geometryId]) return true;

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

    const colStart = eachGeometryColorsBase[geometryIdx];
    const colEnd   = atLastGeometry ? colors.length : eachGeometryColorsBase[geometryIdx + 1];
    const colSlice = colors.subarray(colStart, colEnd);
    if (colSlice.length > 0) params.colorsCompressed = colSlice;

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

    const geometryResult = sceneModel.createGeometryCompressed(params as SceneGeometryCompressedParams);
    if (geometryResult && geometryResult.ok === false) {
      fail(geometryResult.error);
      return false;
    }
    createdIds?.geometries.push(geometryId);
    return true;
  };

  if (sceneModel && numObjects === 0) {
    for (let geometryIdx = 0; geometryIdx < numGeometries; geometryIdx++) {
      if (!createLocalGeometry(geometryIdx, prefixId(eachGeometryId?.[geometryIdx] || `${geometryIdx}`))) {
        return;
      }
    }
  }

  for (let objectIdx = 0; objectIdx < numObjects; objectIdx++) {
    if ((objectIdx & 0x1F) === 0) {
      // Step every 32 objects — geometry building is the
      // heaviest phase but each individual object is fast, so
      // we don't need a per-object yield. 32-object cadence is
      // dense enough for smooth bar updates on big models.
      await step("Building meshes", objectIdx, numObjects);
    }
    const objectId = prefixId(eachObjectId[objectIdx]);
    const atLastObject = (objectIdx === numObjects - 1);
    const firstMeshIdx = eachObjectMeshesBase[objectIdx];
    const lastMeshIdx  = atLastObject ? (numMeshes - 1) : (eachObjectMeshesBase[objectIdx + 1] - 1);
    const meshIds: string[] = [];

    for (let meshIdx = firstMeshIdx; meshIdx <= lastMeshIdx; meshIdx++) {
      const meshId = meshIdPrefix ? `${meshIdPrefix}${meshIdx}` : `${nextMeshId++}`;
      if (sceneModel) {
        const geometryIdx = eachMeshGeometriesBase[meshIdx];
        const hasLocalGeometry = geometryIdx !== NO_INDEX && geometryIdx < numGeometries;
        const geometryId = prefixId(eachMeshGeometryId?.[meshIdx]
          || (hasLocalGeometry ? (eachGeometryId?.[geometryIdx] || `${geometryIdx}`) : ""));

        if (!geometryId) {
          fail(`[xgf] Mesh ${meshIdx} has no geometry reference`);
          return;
        }

        if (hasLocalGeometry && !sceneModel.geometries[geometryId]) {
          if (!createLocalGeometry(geometryIdx, geometryId)) {
            return;
          }
        } else if (!sceneModel.geometries[geometryId]) {
          fail(`[xgf] Mesh ${meshIdx} references missing geometry '${geometryId}'`);
          return;
        }

        const matricesBase = eachMeshMatricesBase[meshIdx];
        const parentTransformId = eachMeshParentTransformId?.[meshIdx] || "";
        const matrix = transformMatrix(matrices.subarray(matricesBase, matricesBase + 16), !parentTransformId);
        const meshParams: any = { id: meshId, geometryId, matrix };
        if (parentTransformId) {
          meshParams.parentTransformId = prefixId(parentTransformId);
        }

        const materialId = eachMeshMaterialId?.[meshIdx] || "";
        const materialIdx = eachMeshMaterial[meshIdx];
        if (materialId) {
          meshParams.materialId = prefixId(materialId);
        } else if (materialIdx >= 0 && materialIdx < numMaterials) {
          meshParams.materialId = prefixId(eachMaterialId[materialIdx]);
        } else {
          // Inline RGBA fallback — same form as v1.
          const colorBase = meshIdx * NUM_MATERIAL_ATTRIBUTES;
          const hasInlineColor = colorBase + 3 < eachMeshMaterialAttributes.length;
          floatColor[0] = hasInlineColor ? eachMeshMaterialAttributes[colorBase]     / 255 : 1;
          floatColor[1] = hasInlineColor ? eachMeshMaterialAttributes[colorBase + 1] / 255 : 1;
          floatColor[2] = hasInlineColor ? eachMeshMaterialAttributes[colorBase + 2] / 255 : 1;
          meshParams.color   = floatColor.slice(0, 3) as unknown as Vec3;
          meshParams.opacity = hasInlineColor ? eachMeshMaterialAttributes[colorBase + 3] / 255 : 1;
        }
        const meshResult = sceneModel.createMesh(meshParams);
        if (meshResult && meshResult.ok === false) {
          fail(meshResult.error);
          return;
        }
        createdIds?.meshes.push(meshId);
      }
      meshIds.push(meshId);
    }

    if (meshIds.length > 0) {
      if (sceneModel) {
        const objectResult = sceneModel.createObject({ id: objectId, meshIds, layerId });
        if (objectResult && objectResult.ok === false) {
          fail(objectResult.error);
          return;
        }
        createdIds?.objects.push(objectId);
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

function nextAvailableNumericMeshId(sceneModel: SceneModel): number {
  let nextMeshId = 0;
  while (sceneModel.meshes[`${nextMeshId}`]) {
    nextMeshId++;
  }
  return nextMeshId;
}
