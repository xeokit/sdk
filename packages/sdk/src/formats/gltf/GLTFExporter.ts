import {type ModelEncodeParams} from "../ModelEncodeParams";
import {ModelExporter} from "../ModelExporter";
import {
  Document,
  type mat4,
  type Material as GLTFMaterial,
  type Primitive as GLTFPrimitive,
  type Texture as GLTFTexture,
  type TextureInfo as GLTFTextureInfo,
  type Accessor as GLTFAccessor,
  WebIO,
} from '@gltf-transform/core';

import {
  octDecodeNormalsU16,
  decompressPoint3WithAABB3,
  decompressUVs
} from "../../base/math/compression";
import {createVec3Float64} from "../../base/math/vector";
import {createMat4Float64, mulMat4} from "../../base/math/matrix";
import {createCoordinateSystemTransform} from "../../model/scene";
import type {SceneGeometry, SceneMaterial, SceneMesh, SceneTexture} from "../../model/scene";
import {yieldToHost} from "../../base/utils";
import type {LoaderProgress} from "../LoaderProgress";

import {
  ClampToEdgeWrapping,
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
  TrianglesPrimitive
} from "../../base/constants";

const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} to glTF (2) format.
 *
 * Emits a binary `.glb` containing:
 *
 *   - The full scene-graph: one node per `SceneObject`, with one child
 *     node per `SceneMesh` carrying its model-space matrix.
 *   - Geometry attributes per `SceneGeometry` — positions (decompressed
 *     from quantised), normals (oct-decoded), texcoords (decompressed
 *     via the geometry's decompress matrix), vertex colours, indices.
 *     Accessors are reused across meshes that share a geometry.
 *   - Full PBR materials per `SceneMaterial` — base colour, metallic +
 *     roughness factors, alpha mode + cutoff, plus colour /
 *     metallic-roughness / normal / occlusion / emissive textures.
 *   - Texture image data, embedded as PNG or JPEG bytes — already-encoded
 *     bytes from the source `SceneTexture.buffers` / `src` (data URL or
 *     URL) are preserved verbatim; image / canvas / `ImageData` sources
 *     are re-encoded as PNG via a 2D canvas. Sampler state (filters +
 *     wrap modes) is mapped from the SceneTexture into glTF.
 *
 * Compressed textures (S3TC, ASTC, BC7, ...) are skipped with a warning
 * — embedding them would require a `KHR_texture_basisu`-style extension
 * that isn't supported here.
 *
 * For detailed usage, refer to {@link gltf | @xeokit/sdk/formats/gltf}.
 */
export class GLTFExporter extends ModelExporter {
  constructor() {
    super({
      format: "glTF",
      fileDataType: "arraybuffer",
      encoders: {
        "2": encode2
      },
      defaultVersion: "2"
    });
  }
}


// =====================================================================
// Encoder
// =====================================================================

async function encode2(params: ModelEncodeParams, options?: any): Promise<Uint8Array<any>> {
  const {sceneModel} = params;
  options = options ?? {};

  const onProgress: ((p: LoaderProgress) => void) | undefined = options.onProgress;
  const signal: AbortSignal | undefined = options.signal;
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

  const coordinateSystemMatrix = options.coordinateSystem
    ? createCoordinateSystemTransform(
      sceneModel.scene.coordinateSystem,
      options.coordinateSystem,
      createMat4Float64()
    )
    : null;

  const io = new WebIO({credentials: 'include'});
  const doc = new Document();
  const gltfScene = doc.createScene();
  const buffer = doc.createBuffer();

  // ── 1. Textures ─────────────────────────────────────────────────
  // Encode every SceneTexture's image bytes once and stash the
  // resulting glTF Texture by id; materials below pick the right
  // texture by SceneTexture.id.
  const textureMap = new Map<string, GLTFTexture>();
  const textureIds = Object.keys(sceneModel.textures);
  for (let ti = 0; ti < textureIds.length; ti++) {
    if ((ti & 0x07) === 0) await step("Encoding textures", ti, textureIds.length);
    const id = textureIds[ti];
    const sceneTex: SceneTexture = sceneModel.textures[id];
    if (sceneTex.compressed) {
      console.warn(`[GLTFExporter] Skipping compressed texture '${sceneTex.id}' (no KHR_texture_basisu support).`);
      continue;
    }
    let imageBytes: Uint8Array<any> | null;
    let mime: string;
    try {
      const out = await encodeSceneTextureBytes(sceneTex);
      imageBytes = out.bytes;
      mime = out.mime;
    } catch (e) {
      console.warn(`[GLTFExporter] Failed to encode texture '${sceneTex.id}': ${(e as Error).message}`);
      continue;
    }
    if (!imageBytes) continue;
    const gltfTex = doc.createTexture(sceneTex.id)
      .setImage(imageBytes)
      .setMimeType(mime);
    textureMap.set(sceneTex.id, gltfTex);
  }

  // ── 2. Materials ────────────────────────────────────────────────
  // PBR (metallic-roughness) materials with optional textures. Texture
  // sampler state (filters / wrap modes) is pushed onto the per-binding
  // TextureInfo so it survives the round-trip.
  const materialMap = new Map<string, GLTFMaterial>();
  const materialIds = Object.keys(sceneModel.materials);
  for (let mi = 0; mi < materialIds.length; mi++) {
    if ((mi & 0x3F) === 0) await step("Encoding materials", mi, materialIds.length);
    const sceneMat: SceneMaterial = sceneModel.materials[materialIds[mi]];
    materialMap.set(sceneMat.id, buildGltfMaterial(doc, sceneMat, textureMap));
  }

  // ── 3. Geometry attribute accessors ─────────────────────────────
  // One bundle per SceneGeometry — position / normal / uv / colour /
  // indices accessors, all uploaded into the shared buffer. Bundles
  // are reused by every mesh that shares the same geometry.
  type AccessorBundle = {
    position: GLTFAccessor;
    normal?: GLTFAccessor;
    uv?: GLTFAccessor;
    color?: GLTFAccessor;
    indices?: GLTFAccessor;
  };
  const accessorCache = new Map<string, AccessorBundle>();

  function getAccessors(geom: SceneGeometry): AccessorBundle | null {
    const cached = accessorCache.get(geom.id);
    if (cached) return cached;

    if (!geom.positionsCompressed || !geom.aabb) return null;

    // Positions — dequantise from int16 → float via the geometry's AABB.
    const positions = new Float32Array(geom.positionsCompressed.length);
    for (let i = 0, n = geom.positionsCompressed.length; i < n; i += 3) {
      tempVec3a[0] = geom.positionsCompressed[i];
      tempVec3a[1] = geom.positionsCompressed[i + 1];
      tempVec3a[2] = geom.positionsCompressed[i + 2];
      decompressPoint3WithAABB3(tempVec3a, geom.aabb, tempVec3b);
      positions[i]     = tempVec3b[0];
      positions[i + 1] = tempVec3b[1];
      positions[i + 2] = tempVec3b[2];
    }
    const positionAccessor = doc.createAccessor()
      .setType('VEC3').setArray(positions).setBuffer(buffer);

    const bundle: AccessorBundle = {position: positionAccessor};

    if (geom.normalsCompressed) {
      // 16-bit oct-encoded (octEncodeNormalsToU16) → 3D unit vectors. Must use
      // the matching U16 decoder; decompressNormals decodes a different format.
      const normals = new Float32Array((geom.normalsCompressed.length / 2) * 3);
      octDecodeNormalsU16(geom.normalsCompressed, normals);
      bundle.normal = doc.createAccessor()
        .setType('VEC3').setArray(normals).setBuffer(buffer);
    }

    if (geom.uvsCompressed) {
      // UVs live in `uvsCompressed` as plain float RG32F; a decompress matrix
      // is present only for quantised UVs and must be applied when it is.
      const uvs = geom.uvsDecompressMatrix
        ? decompressUVs(geom.uvsCompressed, geom.uvsDecompressMatrix, new Float32Array(geom.uvsCompressed.length))
        : new Float32Array(geom.uvsCompressed);
      bundle.uv = doc.createAccessor()
        .setType('VEC2').setArray(uvs as Float32Array).setBuffer(buffer);
    }

    if (geom.colorsCompressed) {
      // Vertex colours arrive as RGBA8; emit float RGBA so glTF doesn't
      // need to assume normalisation rules.
      const stride = 4;
      const colors = new Float32Array(geom.colorsCompressed.length);
      for (let i = 0, n = geom.colorsCompressed.length; i < n; i += stride) {
        colors[i]     = geom.colorsCompressed[i]     / 255;
        colors[i + 1] = geom.colorsCompressed[i + 1] / 255;
        colors[i + 2] = geom.colorsCompressed[i + 2] / 255;
        colors[i + 3] = geom.colorsCompressed[i + 3] / 255;
      }
      bundle.color = doc.createAccessor()
        .setType('VEC4').setArray(colors).setBuffer(buffer);
    }

    if (geom.indices) {
      bundle.indices = doc.createAccessor()
        .setType('SCALAR').setArray(new Uint32Array(geom.indices)).setBuffer(buffer);
    }

    accessorCache.set(geom.id, bundle);
    return bundle;
  }

  // ── 4. Primitive cache ──────────────────────────────────────────
  // A glTF Primitive binds an attribute set + a material. Two SceneMeshes
  // sharing both the same geometry AND the same material can share a
  // Primitive; otherwise we emit a fresh one. SceneMeshes without an
  // explicit material fall back to a per-mesh inline material made of
  // `mesh.color × mesh.opacity`.
  const primitiveCache = new Map<string, GLTFPrimitive>();

  function getPrimitive(geom: SceneGeometry, sceneMesh: SceneMesh): GLTFPrimitive | null {
    const matKey = sceneMesh.material
      ? `mat:${sceneMesh.material.id}`
      : `mesh:${sceneMesh.id}`;
    const cacheKey = `${geom.id}__${matKey}`;
    const cached = primitiveCache.get(cacheKey);
    if (cached) return cached;

    const accessors = getAccessors(geom);
    if (!accessors) return null;

    const prim = doc.createPrimitive()
      .setMode(xeokitPrimToGLTFMode(geom.primitive) as any)
      .setAttribute('POSITION', accessors.position);
    if (accessors.indices) prim.setIndices(accessors.indices);
    if (accessors.normal)  prim.setAttribute('NORMAL', accessors.normal);
    if (accessors.uv)      prim.setAttribute('TEXCOORD_0', accessors.uv);
    if (accessors.color)   prim.setAttribute('COLOR_0', accessors.color);

    if (sceneMesh.material) {
      const mat = materialMap.get(sceneMesh.material.id);
      if (mat) prim.setMaterial(mat);
    } else {
      // Inline material per-mesh — glTF needs a material for the BRDF
      // to make sense, and we want the mesh's own colour/opacity to
      // round-trip.
      const c = sceneMesh.color || [1, 1, 1];
      const a = (c.length > 3 ? (c as any)[3] : sceneMesh.opacity ?? 1.0);
      const fallback = doc.createMaterial(`${sceneMesh.id}__inline`)
        .setBaseColorFactor([c[0], c[1], c[2], a])
        .setMetallicFactor(0)
        .setRoughnessFactor(1)
        .setAlphaMode(a < 1 ? "BLEND" : "OPAQUE");
      prim.setMaterial(fallback);
    }

    primitiveCache.set(cacheKey, prim);
    return prim;
  }

  // ── 5. Walk the scene-graph ─────────────────────────────────────
  // One Node per SceneObject (group), one child Node per SceneMesh
  // carrying the mesh's matrix. Multiple meshes per object stay nested
  // so picking & filtering by object survives the round-trip.
  const objectIds = Object.keys(sceneModel.objects);
  for (let oi = 0; oi < objectIds.length; oi++) {
    if ((oi & 0x1F) === 0) await step("Building glTF nodes", oi, objectIds.length);
    const objectId = objectIds[oi];
    const sceneObject = sceneModel.objects[objectId];
    const sceneMeshes = sceneObject.meshes;
    const objectNode = doc.createNode(sceneObject.id);
    gltfScene.addChild(objectNode);

    for (let j = 0, lenj = sceneMeshes.length; j < lenj; j++) {
      const sceneMesh = sceneMeshes[j];
      const sceneGeometry = sceneMesh.geometry;
      if (!sceneGeometry) continue;

      const prim = getPrimitive(sceneGeometry, sceneMesh);
      if (!prim) continue;
      const mesh = doc.createMesh().addPrimitive(prim);

      // node.matrix should map mesh-local vertices straight to world.
      // Internally that's coordSys * mesh.matrix when a target coord
      // system was given, otherwise just the mesh.matrix.
      const matrix = coordinateSystemMatrix
        ? mulMat4(coordinateSystemMatrix, sceneMesh.matrix as any, createMat4Float64())
        : (sceneMesh.matrix as any);

      const meshNode = doc.createNode(sceneMesh.id)
        .setMesh(mesh)
        .setMatrix(<mat4>matrix);
      objectNode.addChild(meshNode);
    }
  }

  await step("Writing glTF binary", objectIds.length, objectIds.length);
  return await io.writeBinary(doc);
}


// =====================================================================
// Material binding helpers
// =====================================================================

function buildGltfMaterial(
  doc: Document,
  sceneMat: SceneMaterial,
  textureMap: Map<string, GLTFTexture>
): GLTFMaterial {
  const mat = doc.createMaterial(sceneMat.id);

  // Base colour factor includes opacity in alpha — glTF expects RGBA.
  const c = sceneMat.color;
  const opacity = (sceneMat.opacity !== undefined && sceneMat.opacity !== null) ? sceneMat.opacity : 1.0;
  mat.setBaseColorFactor([c[0], c[1], c[2], opacity]);

  // Metallic-roughness factors — both clamped on the SceneMaterial
  // side, so they're already safe for glTF.
  mat.setMetallicFactor(sceneMat.metallic ?? 0);
  mat.setRoughnessFactor(sceneMat.roughness ?? 1);
  const em = sceneMat.emissiveColor;
  if (em) {
    mat.setEmissiveFactor([em[0], em[1], em[2]]);
  }

  // Alpha mode (matches glTF semantics 1:1).
  const alphaMode = sceneMat.alphaMode === 1 ? "MASK"
                   : sceneMat.alphaMode === 2 ? "BLEND"
                   : "OPAQUE";
  mat.setAlphaMode(alphaMode);
  if (alphaMode === "MASK") {
    mat.setAlphaCutoff(sceneMat.alphaCutoff ?? 0.5);
  }

  // Texture bindings + sampler state. Each binding has its own
  // TextureInfo (sampler / texCoord), distinct even when two bindings
  // share a Texture.
  bindTexture(mat, "BaseColor",         sceneMat.colorTexture, textureMap);
  bindTexture(mat, "MetallicRoughness", sceneMat.metallicRoughnessTexture, textureMap);
  bindTexture(mat, "Normal",            sceneMat.normalsTexture, textureMap);
  bindTexture(mat, "Occlusion",         sceneMat.occlusionTexture, textureMap);
  bindTexture(mat, "Emissive",          sceneMat.emissiveTexture, textureMap);

  return mat;
}

type GltfTextureSlot = "BaseColor" | "MetallicRoughness" | "Normal" | "Occlusion" | "Emissive";

function bindTexture(
  mat: GLTFMaterial,
  slot: GltfTextureSlot,
  sceneTex: SceneTexture | undefined,
  textureMap: Map<string, GLTFTexture>
): void {
  if (!sceneTex) return;
  const gltfTex = textureMap.get(sceneTex.id);
  if (!gltfTex) return;
  switch (slot) {
    case "BaseColor":
      mat.setBaseColorTexture(gltfTex);
      applySampler(mat.getBaseColorTextureInfo(), sceneTex);
      break;
    case "MetallicRoughness":
      mat.setMetallicRoughnessTexture(gltfTex);
      applySampler(mat.getMetallicRoughnessTextureInfo(), sceneTex);
      break;
    case "Normal":
      mat.setNormalTexture(gltfTex);
      applySampler(mat.getNormalTextureInfo(), sceneTex);
      break;
    case "Occlusion":
      mat.setOcclusionTexture(gltfTex);
      applySampler(mat.getOcclusionTextureInfo(), sceneTex);
      break;
    case "Emissive":
      mat.setEmissiveTexture(gltfTex);
      applySampler(mat.getEmissiveTextureInfo(), sceneTex);
      break;
  }
}

function applySampler(info: GLTFTextureInfo | null, sceneTex: SceneTexture): void {
  if (!info) return;
  const mag = xeokitFilterToGLTF(sceneTex.magFilter, /*allowMipmap=*/false);
  const min = xeokitFilterToGLTF(sceneTex.minFilter, /*allowMipmap=*/true);
  if (mag !== null) info.setMagFilter(mag as any);
  if (min !== null) info.setMinFilter(min as any);
  info.setWrapS(xeokitWrapToGLTF(sceneTex.wrapS) as any);
  info.setWrapT(xeokitWrapToGLTF(sceneTex.wrapT) as any);
}


// =====================================================================
// Texture image extraction
// =====================================================================

/**
 * Pulls the encoded image bytes out of a SceneTexture in whichever form
 * is available. Priority order:
 *
 *   1. `tex.buffers` (already-encoded PNG/JPEG) — used verbatim.
 *   2. `tex.src` — `data:` URL → bytes; URL → `fetch`.
 *   3. `tex.image` — drawn onto a 2D canvas, encoded as PNG.
 *   4. `tex.imageData` — putImageData onto a canvas, encoded as PNG.
 */
async function encodeSceneTextureBytes(
  tex: SceneTexture
): Promise<{ bytes: Uint8Array<any>, mime: string }> {

  if (tex.buffers && tex.buffers.length > 0 && tex.buffers[0]) {
    const bytes = new Uint8Array(tex.buffers[0]);
    return {bytes, mime: detectImageMime(bytes, tex.mediaType)};
  }

  if (typeof tex.src === "string") {
    if (tex.src.startsWith("data:")) {
      return decodeDataURL(tex.src);
    }
    const resp = await fetch(tex.src);
    if (!resp.ok) throw new Error(`fetch ${tex.src}: ${resp.status} ${resp.statusText}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const mime = resp.headers.get("content-type")?.split(";")[0]?.trim()
      || detectImageMime(bytes, tex.mediaType);
    return {bytes, mime};
  }

  if (tex.image) {
    const w = (tex.image as any).naturalWidth || (tex.image as any).width || 0;
    const h = (tex.image as any).naturalHeight || (tex.image as any).height || 0;
    if (w <= 0 || h <= 0) throw new Error("image has zero dimensions");
    const bytes = await canvasToPNG(w, h, (ctx) => {
      ctx.drawImage(tex.image as any, 0, 0);
    });
    return {bytes, mime: "image/png"};
  }

  if (tex.imageData) {
    const {width, height} = tex.imageData;
    const bytes = await canvasToPNG(width, height, (ctx) => {
      ctx.putImageData(tex.imageData!, 0, 0);
    });
    return {bytes, mime: "image/png"};
  }

  throw new Error(`SceneTexture '${tex.id}' has no extractable image data`);
}

function decodeDataURL(url: string): { bytes: Uint8Array, mime: string } {
  const m = /^data:([^;,]+)(?:;([^,]+))?,(.*)$/s.exec(url);
  if (!m) throw new Error("malformed data URL");
  const mime = m[1] || "application/octet-stream";
  const isBase64 = (m[2] || "").includes("base64");
  const data = m[3];
  if (isBase64) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return {bytes, mime};
  }
  const bytes = new TextEncoder().encode(decodeURIComponent(data));
  return {bytes, mime};
}

/**
 * Best-effort mime-type detection from the first few bytes of an
 * image, falling back to the `mediaType` enum the SceneTexture
 * recorded.
 */
function detectImageMime(bytes: Uint8Array, mediaType?: number): string {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 &&
      bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 &&
      bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (mediaType === PNGMediaType)  return "image/png";
  if (mediaType === JPEGMediaType) return "image/jpeg";
  if (mediaType === GIFMediaType)  return "image/gif";
  return "application/octet-stream";
}

async function canvasToPNG(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): Promise<Uint8Array<any>> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  draw(ctx);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("canvas.toBlob failed")), "image/png")
  );
  return new Uint8Array(await blob.arrayBuffer());
}


// =====================================================================
// Constant maps — xeokit ↔ glTF
// =====================================================================

function xeokitPrimToGLTFMode(prim: number): number {
  // glTF MeshPrimitiveMode: POINTS=0, LINES=1, TRIANGLES=4 (the modes
  // we support). Anything else falls through to TRIANGLES.
  switch (prim) {
    case PointsPrimitive:    return 0;
    case LinesPrimitive:     return 1;
    case TrianglesPrimitive:
    default:                 return 4;
  }
}

function xeokitFilterToGLTF(filter: number, allowMipmap: boolean): number | null {
  // glTF sampler filter values are the raw GL constants.
  switch (filter) {
    case NearestFilter:                return 9728;
    case LinearFilter:                 return 9729;
    case NearestMipMapNearestFilter:   return allowMipmap ? 9984 : 9728;
    case LinearMipMapNearestFilter:    return allowMipmap ? 9985 : 9729;
    case NearestMipMapLinearFilter:    return allowMipmap ? 9986 : 9728;
    case LinearMipMapLinearFilter:     return allowMipmap ? 9987 : 9729;
    default:                           return null;
  }
}

function xeokitWrapToGLTF(wrap: number): number {
  // glTF sampler wrap values: REPEAT=10497, CLAMP_TO_EDGE=33071,
  // MIRRORED_REPEAT=33648.
  switch (wrap) {
    case ClampToEdgeWrapping:    return 33071;
    case MirroredRepeatWrapping: return 33648;
    case RepeatWrapping:
    default:                     return 10497;
  }
}
