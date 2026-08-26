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
import {createMat4Float64, isIdentityMat4} from "../../../../base/math/matrix";
import type {SceneModel} from "../../../../model/scene";
import type {XGFData_v1} from "./XGFData_v1";
import {createCoordinateSystemTransform, getMeshWorldMatrix} from "../../../../model/scene";
import {yieldToHost} from "../../../../base/utils";
import type {LoaderProgress} from "../../../LoaderProgress";

const NUM_MATERIAL_ATTRIBUTES = 4;
const NUM_MATERIAL_TEXTURE_REFS = 5;
const NUM_MATERIAL_PBR_BYTES = 8;
const NUM_TEXTURE_SAMPLER_BYTES = 5;
const NO_INDEX = 0xffffffff;

/** Clamp to a byte — matches the renderer's saturating splat-quaternion quantisation. */
const clampByte = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Compact small-int codes used by the v2 file for sampler params. */
const SAMPLER_CODE: Record<number, number> = {
  [RepeatWrapping]: 1,
  [ClampToEdgeWrapping]: 2,
  [MirroredRepeatWrapping]: 3,
  [NearestFilter]: 4,
  [LinearFilter]: 5,
  [NearestMipMapNearestFilter]: 6,
  [LinearMipMapNearestFilter]: 7,
  [NearestMipMapLinearFilter]: 8,
  [LinearMipMapLinearFilter]: 9
};

/** Compact small-int codes for texture media types. */
const MEDIA_TYPE_CODE: Record<number, number> = {
  [PNGMediaType]: 0,
  [JPEGMediaType]: 1,
  [GIFMediaType]: 2
};

const samplerCode = (v?: number): number =>
  (v !== undefined && SAMPLER_CODE[v] !== undefined) ? SAMPLER_CODE[v] : 0;

/**
 * Encode a SceneModel into the XGF v1 payload.
 *
 * Async because texture re-encoding (canvas → PNG bytes for the
 * `imageData` form) is naturally async via `canvas.toBlob()` /
 * `OffscreenCanvas.convertToBlob()`. Textures backed by `buffers`
 * (already-compressed source) are passed through synchronously.
 *
 * @private
 */
export async function modelToXGF(params: {
  sceneModel: SceneModel;
  options: any;
}): Promise<XGFData_v1> {

  const sceneModel = params.sceneModel;
  const options = params.options || {};
  const ignoreNormals = options.ignoreNormals === true;
  const ignoreUVs = options.ignoreUVs === true;

  const onProgress: ((p: LoaderProgress) => void) | undefined = options.onProgress;
  const signal: AbortSignal | undefined = options.signal;
  // Reusable progress payload — see the LoaderProgress
  // contract: copy out fields you need to retain.
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

  // (Coordinate-system transform is applied through getMeshWorldMatrix
  // below — we don't need to materialise the matrix here.)
  if (options.coordinateSystem) {
    createCoordinateSystemTransform(sceneModel.scene.coordinateSystem, options.coordinateSystem, createMat4Float64());
  }

  const geometriesList = Object.values(sceneModel.geometries);
  const meshesList     = Object.values(sceneModel.meshes);
  const objectsList    = Object.values(sceneModel.objects);
  const texturesList   = Object.values(sceneModel.textures);
  const materialsList  = Object.values(sceneModel.materials);

  const numGeometries = geometriesList.length;
  const numMeshes     = meshesList.length;
  const numObjects    = objectsList.length;
  const numTextures   = texturesList.length;
  const numMaterials  = materialsList.length;

  // ── Pass 1: size geometry payload ──────────────────────────────────
  let sizePositions = 0;
  let sizeColors = 0;
  let sizeIndices = 0;
  let sizeEdgeIndices = 0;
  let sizeNormals = 0;
  let sizeUVs = 0;
  let sizeScales = 0;
  let sizeRotations = 0;

  for (const geometry of geometriesList) {
    if (!geometry || !geometry.positionsCompressed) continue;
    sizePositions   += geometry.positionsCompressed.length;
    if (geometry.indices)         sizeIndices     += geometry.indices.length;
    if (geometry.edgeIndices)     sizeEdgeIndices += geometry.edgeIndices.length;
    if (geometry.colorsCompressed) sizeColors      += geometry.colorsCompressed.length;
    if (!ignoreNormals && geometry.normalsCompressed) sizeNormals += geometry.normalsCompressed.length;
    if (!ignoreUVs && geometry.uvsCompressed) sizeUVs += geometry.uvsCompressed.length;
    if (geometry.scales)           sizeScales      += geometry.scales.length;
    if (geometry.rotations)        sizeRotations   += geometry.rotations.length;
  }

  // ── Pass 2: encode textures ────────────────────────────────────────
  // For each texture, prefer pre-existing compressed `buffers` (KTX2 /
  // already-encoded JPG/PNG). When only an `imageData` is available
  // (e.g. an HTMLImageElement loaded by GLTFLoader), re-encode it to
  // PNG bytes via canvas. Skipped textures get a zero-byte slot.
  const textureBytes: Uint8Array<any>[] = [];
  const textureMediaTypes: number[] = [];
  const textureWidths: number[] = [];
  const textureHeights: number[] = [];
  const textureSamplers: number[] = [];
  const textureEncodings: number[] = [];
  const textureIds: string[] = [];
  const textureIndexById: Record<string, number> = {};

  for (let i = 0; i < numTextures; i++) {
    if ((i & 0x03) === 0) await step("Encoding textures", i, numTextures);
    const tex = texturesList[i];
    textureIds.push(tex.id);
    textureIndexById[tex.id] = i;
    let bytes: Uint8Array<any> | null = null;
    let mediaCode = 255;
    if (tex.buffers && tex.buffers.length > 0 && tex.buffers[0]) {
      bytes = new Uint8Array(tex.buffers[0]);
      // Compressed buffers are typically KTX2/Basis — opaque (255).
      mediaCode = (tex.mediaType !== undefined && MEDIA_TYPE_CODE[tex.mediaType] !== undefined)
        ? MEDIA_TYPE_CODE[tex.mediaType]
        : 255;
    } else if (tex.imageData && tex.imageData.width && tex.imageData.height) {
      bytes = await encodeImageToPNG(tex.imageData);
      mediaCode = MEDIA_TYPE_CODE[PNGMediaType];
    } else if (tex.image && (tex.image as any).width && (tex.image as any).height) {
      // Decoded image source (e.g. an ImageBitmap from GLTFLoader, which
      // populates `image` rather than `imageData`/`buffers`). encodeImageToPNG
      // draws it to a canvas and re-encodes to PNG.
      bytes = await encodeImageToPNG(tex.image);
      mediaCode = MEDIA_TYPE_CODE[PNGMediaType];
    }
    if (!bytes) {
      console.warn(`[xgf] Texture '${tex.id}' has no buffers, imageData or image — encoded as empty`);
      bytes = new Uint8Array(0);
    }
    textureBytes.push(bytes);
    textureMediaTypes.push(mediaCode);
    textureWidths.push(tex.width || (tex.imageData?.width ?? (tex.image as any)?.width ?? 0));
    textureHeights.push(tex.height || (tex.imageData?.height ?? (tex.image as any)?.height ?? 0));
    textureSamplers.push(
      samplerCode(tex.minFilter),
      samplerCode(tex.magFilter),
      samplerCode(tex.wrapS),
      samplerCode(tex.wrapT),
      samplerCode(tex.wrapR)
    );
    // Colour-space encoding (sRGB vs linear). Without this the colour/albedo
    // map — created as sRGB — reloads as linear and renders washed out.
    textureEncodings.push(tex.encoding);
  }

  let textureDataSize = 0;
  for (const b of textureBytes) textureDataSize += b.length;
  const textureData = new Uint8Array(textureDataSize);
  const eachTextureDataBase = new Uint32Array(numTextures);
  {
    let cursor = 0;
    for (let i = 0; i < numTextures; i++) {
      eachTextureDataBase[i] = cursor;
      textureData.set(textureBytes[i], cursor);
      cursor += textureBytes[i].length;
    }
  }

  // ── Pass 3: encode materials ───────────────────────────────────────
  const materialIndexById: Record<string, number> = {};
  const eachMaterialPBR = new Uint8Array(numMaterials * NUM_MATERIAL_PBR_BYTES);
  // Full-precision RGB colour factor. Kept as float (not the u8 in
  // eachMaterialPBR) because SceneMaterial.color is an unclamped multiplier that
  // commonly exceeds 1.0 (e.g. a perceptual brightness boost); u8 would clamp
  // those to 1.0 and render the material washed out on reload.
  const eachMaterialColor = new Float32Array(numMaterials * 3);
  const eachMaterialTextures = new Int32Array(numMaterials * NUM_MATERIAL_TEXTURE_REFS);
  const eachMaterialTriplanarScale = new Float32Array(numMaterials);
  const eachMaterialId: string[] = [];
  for (let i = 0; i < numMaterials; i++) {
    if ((i & 0x3F) === 0) await step("Encoding materials", i, numMaterials);
    const mat = materialsList[i];
    materialIndexById[mat.id] = i;
    eachMaterialId.push(mat.id);
    const base = i * NUM_MATERIAL_PBR_BYTES;
    eachMaterialColor[i * 3]     = mat.color[0];
    eachMaterialColor[i * 3 + 1] = mat.color[1];
    eachMaterialColor[i * 3 + 2] = mat.color[2];
    eachMaterialPBR[base]     = clampU8(mat.color[0] * 255);
    eachMaterialPBR[base + 1] = clampU8(mat.color[1] * 255);
    eachMaterialPBR[base + 2] = clampU8(mat.color[2] * 255);
    eachMaterialPBR[base + 3] = clampU8(mat.opacity * 255);
    eachMaterialPBR[base + 4] = clampU8(mat.roughness * 255);
    eachMaterialPBR[base + 5] = clampU8(mat.metallic * 255);
    eachMaterialPBR[base + 6] = clampU8(mat.alphaMode);
    eachMaterialPBR[base + 7] = clampU8(mat.alphaCutoff * 255);
    const tBase = i * NUM_MATERIAL_TEXTURE_REFS;
    eachMaterialTextures[tBase]     = textureIndexOrNone(mat.colorTexture?.id, textureIndexById);
    eachMaterialTextures[tBase + 1] = textureIndexOrNone(mat.metallicRoughnessTexture?.id, textureIndexById);
    eachMaterialTextures[tBase + 2] = textureIndexOrNone(mat.normalsTexture?.id, textureIndexById);
    eachMaterialTextures[tBase + 3] = textureIndexOrNone(mat.occlusionTexture?.id, textureIndexById);
    eachMaterialTextures[tBase + 4] = textureIndexOrNone(mat.emissiveTexture?.id, textureIndexById);
    eachMaterialTriplanarScale[i] = mat.triplanarScale;
  }

  // ── Pass 4: pack geometry payload ──────────────────────────────────
  const xgfData: XGFData_v1 = {
    positions: new Uint16Array(sizePositions),
    colors: new Uint8Array(sizeColors),
    indices: new Uint32Array(sizeIndices),
    edgeIndices: new Uint32Array(sizeEdgeIndices),
    aabbs: new Float32Array(0), // populated below
    normals: new Uint16Array(sizeNormals),
    uvs: new Float32Array(sizeUVs),
    scales: new Float32Array(sizeScales),
    rotations: new Uint8Array(sizeRotations),
    eachGeometryPositionsBase: new Uint32Array(numGeometries),
    eachGeometryColorsBase: new Uint32Array(numGeometries),
    eachGeometryIndicesBase: new Uint32Array(numGeometries),
    eachGeometryEdgeIndicesBase: new Uint32Array(numGeometries),
    eachGeometryNormalsBase: new Uint32Array(numGeometries),
    eachGeometryUVsBase: new Uint32Array(numGeometries),
    eachGeometryScalesBase: new Uint32Array(numGeometries),
    eachGeometryRotationsBase: new Uint32Array(numGeometries),
    eachGeometryPrimitiveType: new Uint8Array(numGeometries),
    eachGeometryAABBBase: new Uint32Array(numGeometries),
    matrices: new Float64Array(0), // populated below
    textureData,
    eachTextureDataBase,
    eachTextureMediaType: new Uint8Array(textureMediaTypes),
    eachTextureWidth: new Uint16Array(textureWidths),
    eachTextureHeight: new Uint16Array(textureHeights),
    eachTextureSampler: new Uint8Array(textureSamplers),
    eachTextureEncoding: new Uint16Array(textureEncodings),
    eachTextureId: textureIds,
    eachMaterialPBR,
    eachMaterialColor,
    eachMaterialTextures,
    eachMaterialId,
    eachMaterialTriplanarScale,
    eachMeshGeometriesBase: new Uint32Array(numMeshes),
    eachMeshMatricesBase: new Uint32Array(numMeshes),
    eachMeshMaterialAttributes: new Uint8Array(numMeshes * NUM_MATERIAL_ATTRIBUTES),
    eachMeshMaterial: new Int32Array(numMeshes),
    eachObjectId: [],
    eachObjectMeshesBase: new Uint32Array(numObjects)
  };

  let positionsBase = 0;
  let colorsBase = 0;
  let indicesBase = 0;
  let edgeIndicesBase = 0;
  let normalsBase = 0;
  let uvsBase = 0;
  let scalesBase = 0;
  let rotationsBase = 0;
  let aabbsBase = 0;

  const aabbIdxMap: Record<string, number> = {};
  const aabbs: number[] = [];
  const matrices: number[] = [];
  const geometryIndices: Record<string, number> = {};

  for (let geometryIdx = 0; geometryIdx < numGeometries; geometryIdx++) {
    const geometry = geometriesList[geometryIdx];
    let primitiveType = 0;
    switch (geometry.primitive) {
      case TrianglesPrimitive: primitiveType = 0; break;
      case SolidPrimitive:     primitiveType = 1; break;
      case SurfacePrimitive:   primitiveType = 2; break;
      case LinesPrimitive:     primitiveType = 3; break;
      case PointsPrimitive:    primitiveType = 4; break;
      case GaussianSplatsPrimitive: primitiveType = 5; break;
    }
    xgfData.eachGeometryPrimitiveType[geometryIdx] = primitiveType;

    const aabb = geometry.aabb;
    const aabbHash = `${aabb[0]}-${aabb[1]}-${aabb[2]}-${aabb[3]}-${aabb[4]}-${aabb[5]}`;
    let aabbIdx = aabbIdxMap[aabbHash];
    if (aabbIdx === undefined) {
      aabbIdx = aabbsBase;
      aabbIdxMap[aabbHash] = aabbIdx;
      aabbs.push(...aabb);
      aabbsBase += 6;
    }
    xgfData.eachGeometryAABBBase[geometryIdx] = aabbIdx;

    xgfData.eachGeometryPositionsBase[geometryIdx] = positionsBase;
    xgfData.positions.set(geometry.positionsCompressed, positionsBase);
    positionsBase += geometry.positionsCompressed.length;

    xgfData.eachGeometryColorsBase[geometryIdx] = colorsBase;
    if (geometry.colorsCompressed) {
      xgfData.colors.set(geometry.colorsCompressed, colorsBase);
      colorsBase += geometry.colorsCompressed.length;
    }

    xgfData.eachGeometryIndicesBase[geometryIdx] = indicesBase;
    if (geometry.indices) {
      xgfData.indices.set(geometry.indices, indicesBase);
      indicesBase += geometry.indices.length;
    }

    xgfData.eachGeometryEdgeIndicesBase[geometryIdx] = edgeIndicesBase;
    if (geometry.edgeIndices) {
      xgfData.edgeIndices.set(geometry.edgeIndices, edgeIndicesBase);
      edgeIndicesBase += geometry.edgeIndices.length;
    }

    if (!ignoreNormals && geometry.normalsCompressed) {
      xgfData.eachGeometryNormalsBase[geometryIdx] = normalsBase;
      xgfData.normals.set(geometry.normalsCompressed, normalsBase);
      normalsBase += geometry.normalsCompressed.length;
    } else {
      xgfData.eachGeometryNormalsBase[geometryIdx] = NO_INDEX;
    }

    if (!ignoreUVs && geometry.uvsCompressed) {
      xgfData.eachGeometryUVsBase[geometryIdx] = uvsBase;
      xgfData.uvs.set(geometry.uvsCompressed, uvsBase);
      uvsBase += geometry.uvsCompressed.length;
    } else {
      xgfData.eachGeometryUVsBase[geometryIdx] = NO_INDEX;
    }

    // Gaussian-splat geometries carry per-splat scales (float xyz) and rotation
    // quaternions (float xyzw, quantised to bytes here, the .splat convention).
    if (geometry.scales && geometry.rotations) {
      xgfData.eachGeometryScalesBase[geometryIdx] = scalesBase;
      xgfData.scales.set(geometry.scales, scalesBase);
      scalesBase += geometry.scales.length;

      xgfData.eachGeometryRotationsBase[geometryIdx] = rotationsBase;
      const rotations = geometry.rotations;
      for (let i = 0, len = rotations.length; i < len; i++) {
        xgfData.rotations[rotationsBase + i] = clampByte(Math.round(rotations[i] * 128 + 128));
      }
      rotationsBase += rotations.length;
    } else {
      xgfData.eachGeometryScalesBase[geometryIdx] = NO_INDEX;
      xgfData.eachGeometryRotationsBase[geometryIdx] = NO_INDEX;
    }

    geometryIndices[geometry.id] = geometryIdx;
  }

  // ── Pass 5: meshes + objects ───────────────────────────────────────
  let identityMatrixAdded = false;
  let identityMatrixBase = 0;
  let matricesBase = 0;
  let meshesBase = 0;
  let materialAttrBase = 0;
  for (let objectIdx = 0; objectIdx < numObjects; objectIdx++) {
    if ((objectIdx & 0x1F) === 0) {
      await step("Encoding objects", objectIdx, numObjects);
    }
    const object = objectsList[objectIdx];
    xgfData.eachObjectId[objectIdx] = object.id;
    xgfData.eachObjectMeshesBase[objectIdx] = meshesBase;
    for (let i = 0; i < object.meshes.length; i++) {
      const mesh = object.meshes[i];
      xgfData.eachMeshGeometriesBase[meshesBase] = geometryIndices[mesh.geometry.id];
      const matrix = getMeshWorldMatrix(mesh, options.coordinateSystem);
      if (isIdentityMat4(matrix)) {
        if (!identityMatrixAdded) {
          matrices.push(...matrix);
          xgfData.eachMeshMatricesBase[meshesBase] = matricesBase;
          identityMatrixBase = matricesBase;
          matricesBase += 16;
          identityMatrixAdded = true;
        } else {
          xgfData.eachMeshMatricesBase[meshesBase] = identityMatrixBase;
        }
      } else {
        matrices.push(...matrix);
        xgfData.eachMeshMatricesBase[meshesBase] = matricesBase;
        matricesBase += 16;
      }
      // Inline RGBA fallback. Used at load time only when the mesh has
      // no material reference, but we always populate it so older
      // viewers (and v1 round-trip code paths) keep working.
      xgfData.eachMeshMaterialAttributes[materialAttrBase++] = clampU8(mesh.effectiveColor[0] * 255);
      xgfData.eachMeshMaterialAttributes[materialAttrBase++] = clampU8(mesh.effectiveColor[1] * 255);
      xgfData.eachMeshMaterialAttributes[materialAttrBase++] = clampU8(mesh.effectiveColor[2] * 255);
      xgfData.eachMeshMaterialAttributes[materialAttrBase++] = clampU8(mesh.effectiveOpacity * 255);
      xgfData.eachMeshMaterial[meshesBase] = mesh.material
        ? (materialIndexById[mesh.material.id] ?? -1)
        : -1;
      meshesBase++;
    }
  }

  xgfData.aabbs    = new Float32Array(aabbs);
  xgfData.matrices = new Float64Array(matrices);

  // Final emit so the bar reads as 100% before the promise
  // resolves regardless of which loop was last.
  if (onProgress) {
    progress.phase = "Encoding objects";
    progress.current = numObjects;
    progress.total = numObjects;
    onProgress(progress);
  }

  return xgfData;
}

function clampU8(v: number): number {
  v = Math.round(v);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function textureIndexOrNone(id: string | undefined, indexById: Record<string, number>): number {
  if (!id) return -1;
  const idx = indexById[id];
  return (idx === undefined) ? -1 : idx;
}

/**
 * Re-encode a texture image to PNG bytes. Accepts both drawable sources
 * (`HTMLImageElement` / `ImageBitmap` / `OffscreenCanvas` / `HTMLCanvasElement`)
 * and raw RGBA pixel buffers (`ImageData` or any `{data, width, height}`-shaped
 * value, e.g. `MaterialPixelBuffer` from `generation/paintMaterials`).
 *
 * Uses an `OffscreenCanvas` when available — that's the faster path;
 * falls back to a DOM canvas + `toBlob` otherwise.
 */
async function encodeImageToPNG(imageData: any): Promise<Uint8Array<any>> {
  const w = imageData.width, h = imageData.height;

  // Raw pixel buffers (MaterialPixelBuffer, ImageData, or the
  // serialised-array form) need putImageData — drawImage rejects them.
  const isPixelBuffer = imageData && imageData.data && imageData.data.length === w * h * 4;

  const paint = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
    if (isPixelBuffer) {
      const bytes = imageData.data instanceof Uint8ClampedArray
        ? imageData.data
        : new Uint8ClampedArray(imageData.data);
      const id = (typeof ImageData !== "undefined" && imageData instanceof ImageData)
        ? imageData
        : new ImageData(bytes, w, h);
      ctx.putImageData(id, 0, 0);
    } else {
      ctx.drawImage(imageData, 0, 0);
    }
  };

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return new Uint8Array(0);
    paint(ctx);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new Uint8Array(0);
    paint(ctx);
    return await new Promise<Uint8Array>((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve(new Uint8Array(0));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/png");
    });
  }
  // Headless (Node) — no browser canvas. Encode via @napi-rs/canvas.
  return encodeImageToPNGNode(imageData, w, h, isPixelBuffer);
}

/**
 * Node fallback for {@link encodeImageToPNG} using `@napi-rs/canvas`, so the
 * XGF exporter can encode textures headlessly (CLI / conversion pipelines).
 *
 * The native module is loaded through a non-analyzable `require` so neither the
 * browser nor the CLI esbuild bundle inlines its `.node` binary; this function
 * only runs when no browser canvas is present.
 */
function encodeImageToPNGNode(imageData: any, w: number, h: number, isPixelBuffer: boolean): Uint8Array {
  const requireFn: (id: string) => any = eval("require");
  const {createCanvas, ImageData: NodeImageData} = requireFn("@napi-rs/canvas");
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (isPixelBuffer) {
    const bytes = imageData.data instanceof Uint8ClampedArray
      ? imageData.data
      : new Uint8ClampedArray(imageData.data);
    ctx.putImageData(new NodeImageData(bytes, w, h), 0, 0);
  } else {
    ctx.drawImage(imageData, 0, 0);
  }
  return new Uint8Array(canvas.toBuffer("image/png"));
}
