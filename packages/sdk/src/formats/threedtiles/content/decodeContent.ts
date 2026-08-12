/**
 * Decoders for 3D Tiles tile content blobs (b3dm, pnts, i3dm, cmpt) and for
 * bare glTF/GLB content (3D Tiles 1.1). Each decoder populates the target
 * SceneModel (and, for b3dm Batch Tables, the DataModel), placing geometry with
 * the tile's composed world transform.
 *
 * glTF content is authored Y-up; tile coordinates are Z-up, so glTF content is
 * additionally rotated +90° about X (`Y_UP_TO_Z_UP`). Point and instance
 * positions are already in tile coordinates and are not rotated.
 */

import {
  createMat4Float64,
  inverseMat4,
  type Mat4,
  mulMat4,
  translationMat4v,
} from "../../../base/math/matrix";
import {PointsPrimitive} from "../../../base/constants";
import type {DataModel} from "../../../model/data/DataModel";
import type {SceneModel} from "../../../model/scene";
import type {ThreeDTilesLoadOptions} from "../ThreeDTilesLoadOptions";
import {GLTFLoader} from "../../gltf";
import {decodeTableJSON, readBatchTable, readFeatureValue} from "./binaryTables";

const Y_UP_TO_Z_UP: Mat4 = createMat4Float64([
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
]);

/** State threaded through content decoding for a single tile. */
export interface TileContentCtx {
  sceneModel?: SceneModel;
  dataModel?: DataModel;
  /** Tile-to-world transform (Z-up), composed down the tileset tree. */
  worldMatrix: Mat4;
  /** Unique prefix for generated geometry/mesh/object ids. */
  idPrefix: string;
  baseUri?: string;
  options: ThreeDTilesLoadOptions;
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  resolveUrl: (uri: string, baseUri: string | undefined) => string;
  /** Parent DataObject that per-feature objects aggregate under, if any. */
  rootDataObjectId?: string;
}

export async function decodeTileContent(buffer: ArrayBuffer, ctx: TileContentCtx): Promise<void> {
  const magic = magicOf(buffer);
  switch (magic) {
    case "b3dm": return decodeB3DM(buffer, ctx);
    case "pnts": return decodePNTS(buffer, ctx);
    case "i3dm": return decodeI3DM(buffer, ctx);
    case "cmpt": return decodeCMPT(buffer, ctx);
    case "glTF": return decodeGLTFContent(buffer, ctx, contentMatrix(ctx.worldMatrix, null, true));
    default:
      // 3D Tiles 1.1 also allows bare JSON glTF as content (not just binary
      // GLB). External tilesets (also JSON) are routed by `.json` extension
      // before reaching here, so a JSON blob at this point is glTF content.
      if (isJSONGLTF(buffer)) {
        return decodeGLTFContent(buffer, ctx, contentMatrix(ctx.worldMatrix, null, true));
      }
      throw new Error(`[ThreeDTilesLoader] Unsupported tile content magic "${magic}"`);
  }
}

function magicOf(buffer: ArrayBuffer): string {
  const b = new Uint8Array(buffer, 0, 4);
  return String.fromCharCode(b[0], b[1], b[2], b[3]);
}

/** True when the content's first non-whitespace byte is `{` — a JSON glTF. */
function isJSONGLTF(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer);
  let i = 0;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3; // UTF-8 BOM
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i++;
  return b[i] === 0x7b;
}

/** world · translate(rtcCenter) · (Y_UP_TO_Z_UP when the content is glTF). */
function contentMatrix(world: Mat4, rtcCenter: number[] | null, gltf: boolean): Mat4 {
  let m = createMat4Float64(world);
  if (rtcCenter) {
    m = mulMat4(m, translationMat4v(rtcCenter as any), createMat4Float64());
  }
  if (gltf) {
    m = mulMat4(m, Y_UP_TO_Z_UP, createMat4Float64());
  }
  return m;
}

async function decodeGLTFContent(content: ArrayBuffer, ctx: TileContentCtx, rootMatrix: Mat4): Promise<void> {
  if (!ctx.sceneModel) return;
  // Binary GLB and JSON glTF are both accepted (loaders.gl detects which). The
  // DataModel receives per-feature glTF metadata (EXT_structural_metadata),
  // aggregated under the tileset's root DataObject; glTF node names are not
  // mapped (b3dm Batch Tables and tileset metadata cover semantics).
  await new GLTFLoader().load(
    {fileData: content, sceneModel: ctx.sceneModel, dataModel: ctx.dataModel},
    {
      rootMatrix,
      baseUri: ctx.baseUri,
      signal: ctx.options.signal,
      layerId: ctx.options.layerId,
      dracoModule: ctx.options.dracoModule,
      dataParentId: ctx.rootDataObjectId,
    },
  );
}

interface TileTables {
  ftJSON: any;
  ftBin: Uint8Array;
  btJSONBytes: Uint8Array;
  btBin: Uint8Array;
  bodyOffset: number;
  byteLength: number;
}

/** Reads the Feature/Batch tables shared by b3dm and pnts (28-byte header). */
function readTables28(buffer: ArrayBuffer): TileTables {
  const dv = new DataView(buffer);
  const byteLength = dv.getUint32(8, true);
  const ftJSONLen = dv.getUint32(12, true);
  const ftBinLen = dv.getUint32(16, true);
  const btJSONLen = dv.getUint32(20, true);
  const btBinLen = dv.getUint32(24, true);
  let offset = 28;
  const ftJSON = decodeTableJSON(new Uint8Array(buffer, offset, ftJSONLen));
  offset += ftJSONLen;
  const ftBin = new Uint8Array(buffer, offset, ftBinLen);
  offset += ftBinLen;
  const btJSONBytes = new Uint8Array(buffer, offset, btJSONLen);
  offset += btJSONLen;
  const btBin = new Uint8Array(buffer, offset, btBinLen);
  offset += btBinLen;
  return {ftJSON, ftBin, btJSONBytes, btBin, bodyOffset: offset, byteLength};
}

async function decodeB3DM(buffer: ArrayBuffer, ctx: TileContentCtx): Promise<void> {
  const t = readTables28(buffer);
  const glb = buffer.slice(t.bodyOffset, t.byteLength);
  const rtc = (t.ftJSON.RTC_CENTER as number[]) || null;
  await decodeGLTFContent(glb, ctx, contentMatrix(ctx.worldMatrix, rtc, true));

  if (ctx.dataModel && t.btJSONBytes.length > 0) {
    const batchLength = t.ftJSON.BATCH_LENGTH || 0;
    const btJSON = decodeTableJSON(t.btJSONBytes);
    addBatchTableToDataModel(ctx, btJSON, t.btBin, batchLength);
  }
}

async function decodePNTS(buffer: ArrayBuffer, ctx: TileContentCtx): Promise<void> {
  if (!ctx.sceneModel) return;
  const t = readTables28(buffer);
  const count = t.ftJSON.POINTS_LENGTH || 0;
  if (count === 0) return;

  const positions = readPntsPositions(t.ftJSON, t.ftBin, count);
  if (!positions) return;
  const colors = readPntsColors(t.ftJSON, t.ftBin, count);
  const rtc = (t.ftJSON.RTC_CENTER as number[]) || null;

  const geometryId = `${ctx.idPrefix}-pts-geom`;
  const meshId = `${ctx.idPrefix}-pts-mesh`;
  const objectId = `${ctx.idPrefix}-pts`;

  ctx.sceneModel.createGeometry({id: geometryId, primitive: PointsPrimitive, positions, colors});
  ctx.sceneModel.createMesh({
    id: meshId,
    geometryId,
    matrix: contentMatrix(ctx.worldMatrix, rtc, false),
  });
  ctx.sceneModel.createObject({id: objectId, meshIds: [meshId], layerId: ctx.options.layerId});
}

function readPntsPositions(ftJSON: any, ftBin: Uint8Array, count: number): Float32Array | null {
  if (ftJSON.POSITION) {
    return readFeatureValue(ftJSON, ftBin, "POSITION", Float32Array, 3, count) as Float32Array;
  }
  if (ftJSON.POSITION_QUANTIZED) {
    const offset = ftJSON.QUANTIZED_VOLUME_OFFSET as number[];
    const scale = ftJSON.QUANTIZED_VOLUME_SCALE as number[];
    if (!offset || !scale) return null;
    const q = readFeatureValue(ftJSON, ftBin, "POSITION_QUANTIZED", Uint16Array, 3, count) as Uint16Array;
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < 3; c++) {
        out[i * 3 + c] = offset[c] + (q[i * 3 + c] / 65535) * scale[c];
      }
    }
    return out;
  }
  return null;
}

function readPntsColors(ftJSON: any, ftBin: Uint8Array, count: number): Float32Array | null {
  if (ftJSON.RGBA) {
    const rgba = readFeatureValue(ftJSON, ftBin, "RGBA", Uint8Array, 4, count) as Uint8Array;
    const out = new Float32Array(count * 4);
    for (let i = 0; i < rgba.length; i++) out[i] = rgba[i] / 255;
    return out;
  }
  if (ftJSON.RGB) {
    const rgb = readFeatureValue(ftJSON, ftBin, "RGB", Uint8Array, 3, count) as Uint8Array;
    const out = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      out[i * 4] = rgb[i * 3] / 255;
      out[i * 4 + 1] = rgb[i * 3 + 1] / 255;
      out[i * 4 + 2] = rgb[i * 3 + 2] / 255;
      out[i * 4 + 3] = 1;
    }
    return out;
  }
  return null;
}

async function decodeI3DM(buffer: ArrayBuffer, ctx: TileContentCtx): Promise<void> {
  if (!ctx.sceneModel) return;
  const dv = new DataView(buffer);
  const byteLength = dv.getUint32(8, true);
  const ftJSONLen = dv.getUint32(12, true);
  const ftBinLen = dv.getUint32(16, true);
  const btJSONLen = dv.getUint32(20, true);
  const btBinLen = dv.getUint32(24, true);
  const gltfFormat = dv.getUint32(28, true);
  let offset = 32;
  const ftJSON = decodeTableJSON(new Uint8Array(buffer, offset, ftJSONLen));
  offset += ftJSONLen;
  const ftBin = new Uint8Array(buffer, offset, ftBinLen);
  offset += ftBinLen + btJSONLen + btBinLen;

  const instanceCount = ftJSON.INSTANCES_LENGTH || 0;
  if (instanceCount === 0) return;

  const glb = await resolveI3DMGlb(buffer, offset, byteLength, gltfFormat, ctx);
  if (!glb) return;

  const rtc = (ftJSON.RTC_CENTER as number[]) || null;
  const attrs = readInstanceAttrs(ftJSON, ftBin, instanceCount);
  if (!attrs.positions) return;

  const meshesBefore = Object.keys(ctx.sceneModel.meshes);
  const instance0 = instanceMatrix(ctx, rtc, attrs, 0);
  await decodeGLTFContent(glb, ctx, mulMat4(instance0, Y_UP_TO_Z_UP, createMat4Float64()));
  const baseMeshes = Object.keys(ctx.sceneModel.meshes).filter(id => meshesBefore.indexOf(id) === -1);
  if (baseMeshes.length === 0) return;

  // Decode the glTF once, then place the remaining instances by cloning those
  // meshes with a relative transform — avoids re-decoding the model per
  // instance while sharing one copy of the geometry.
  const inv0 = inverseMat4(instance0, createMat4Float64());
  for (let i = 1; i < instanceCount; i++) {
    const delta = mulMat4(instanceMatrix(ctx, rtc, attrs, i), inv0, createMat4Float64());
    const meshIds: string[] = [];
    for (let m = 0; m < baseMeshes.length; m++) {
      const base = ctx.sceneModel.meshes[baseMeshes[m]];
      const meshId = `${ctx.idPrefix}-i${i}-${m}`;
      ctx.sceneModel.createMesh({
        id: meshId,
        geometryId: base.geometryId,
        materialId: base.materialId,
        color: base.color,
        opacity: base.opacity,
        matrix: mulMat4(delta, base.matrix as Mat4, createMat4Float64()),
        billboard: base.billboard,
        bin: base.bin,
      });
      meshIds.push(meshId);
    }
    ctx.sceneModel.createObject({id: `${ctx.idPrefix}-i${i}`, meshIds, layerId: ctx.options.layerId});
  }
}

async function resolveI3DMGlb(
  buffer: ArrayBuffer,
  offset: number,
  byteLength: number,
  gltfFormat: number,
  ctx: TileContentCtx,
): Promise<ArrayBuffer | null> {
  if (gltfFormat === 1) {
    return buffer.slice(offset, byteLength);
  }
  const uri = new TextDecoder().decode(new Uint8Array(buffer, offset, byteLength - offset)).trim();
  if (!uri || !ctx.baseUri) return null;
  return ctx.fetchArrayBuffer(ctx.resolveUrl(uri, ctx.baseUri));
}

interface InstanceAttrs {
  positions: Float32Array | null;
  normalUp: Float32Array | null;
  normalRight: Float32Array | null;
  scale: Float32Array | null;
  scaleNonUniform: Float32Array | null;
}

function readInstanceAttrs(ftJSON: any, ftBin: Uint8Array, count: number): InstanceAttrs {
  return {
    positions: readFeatureValue(ftJSON, ftBin, "POSITION", Float32Array, 3, count) as Float32Array,
    normalUp: readFeatureValue(ftJSON, ftBin, "NORMAL_UP", Float32Array, 3, count) as Float32Array,
    normalRight: readFeatureValue(ftJSON, ftBin, "NORMAL_RIGHT", Float32Array, 3, count) as Float32Array,
    scale: readFeatureValue(ftJSON, ftBin, "SCALE", Float32Array, 1, count) as Float32Array,
    scaleNonUniform: readFeatureValue(ftJSON, ftBin, "SCALE_NON_UNIFORM", Float32Array, 3, count) as Float32Array,
  };
}

/**
 * world · translate(rtc) · translate(position) · rotation · scale for instance
 * `i`. Rotation is built from the NORMAL_UP / NORMAL_RIGHT axes when present;
 * SCALE / SCALE_NON_UNIFORM give uniform / per-axis scale. Oct-encoded normals
 * (`*_OCT32P`) and EAST_NORTH_UP orientation are not handled — those default to
 * identity rotation.
 */
function instanceMatrix(ctx: TileContentCtx, rtc: number[] | null, attrs: InstanceAttrs, i: number): Mat4 {
  let m = contentMatrix(ctx.worldMatrix, rtc, false);
  const p = attrs.positions!;
  m = mulMat4(m, translationMat4v([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]] as any), createMat4Float64());

  if (attrs.normalUp && attrs.normalRight) {
    const u = attrs.normalUp, r = attrs.normalRight;
    const rot = rotationFromAxes(
      [r[i * 3], r[i * 3 + 1], r[i * 3 + 2]],
      [u[i * 3], u[i * 3 + 1], u[i * 3 + 2]],
    );
    m = mulMat4(m, rot, createMat4Float64());
  }

  const scale = instanceScaleMatrix(attrs, i);
  if (scale) {
    m = mulMat4(m, scale, createMat4Float64());
  }
  return m;
}

function instanceScaleMatrix(attrs: InstanceAttrs, i: number): Mat4 | null {
  if (attrs.scaleNonUniform) {
    const s = attrs.scaleNonUniform;
    return scaleMatrix(s[i * 3], s[i * 3 + 1], s[i * 3 + 2]);
  }
  if (attrs.scale) {
    const s = attrs.scale[i];
    return scaleMatrix(s, s, s);
  }
  return null;
}

function scaleMatrix(x: number, y: number, z: number): Mat4 {
  return createMat4Float64([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
}

/** Column-major rotation whose columns are [right, up, right×up]. */
function rotationFromAxes(right: number[], up: number[]): Mat4 {
  const r = normalize3(right);
  const u = normalize3(up);
  const f = cross3(r, u);
  return createMat4Float64([
    r[0], r[1], r[2], 0,
    u[0], u[1], u[2], 0,
    f[0], f[1], f[2], 0,
    0, 0, 0, 1,
  ]);
}

function normalize3(v: number[]): number[] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross3(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

async function decodeCMPT(buffer: ArrayBuffer, ctx: TileContentCtx): Promise<void> {
  const dv = new DataView(buffer);
  const tilesLength = dv.getUint32(12, true);
  let offset = 16;
  for (let i = 0; i < tilesLength; i++) {
    const innerLength = dv.getUint32(offset + 8, true);
    await decodeTileContent(buffer.slice(offset, offset + innerLength), {
      ...ctx,
      idPrefix: `${ctx.idPrefix}-c${i}`,
    });
    offset += innerLength;
  }
}

function addBatchTableToDataModel(
  ctx: TileContentCtx,
  btJSON: any,
  btBin: Uint8Array,
  batchLength: number,
): void {
  const dataModel = ctx.dataModel!;
  const table = readBatchTable(btJSON, btBin, batchLength);
  const keys = Object.keys(table);
  if (keys.length === 0) return;

  for (let i = 0; i < batchLength; i++) {
    const propertySetId = `${ctx.idPrefix}-f${i}-props`;
    dataModel.createPropertySet({
      id: propertySetId,
      name: "3D Tiles feature properties",
      type: "Default",
      properties: keys.map(key => ({name: key, value: table[key][i]})),
    });
    const objectId = `${ctx.idPrefix}-f${i}`;
    dataModel.createObject({
      id: objectId,
      type: "Feature",
      name: `Feature ${i}`,
      propertySetIds: [propertySetId],
    });
    if (ctx.rootDataObjectId) {
      dataModel.createRelationship({
        type: "BasicAggregation",
        relatingObjectId: ctx.rootDataObjectId,
          relatedObjectId: objectId,
      });
    }
  }
}
