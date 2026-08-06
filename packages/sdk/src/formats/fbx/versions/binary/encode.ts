/**
 * Encodes a {@link model!scene.SceneModel | SceneModel} into a binary FBX
 * document — the inverse of {@link parse}.
 *
 * v1 scope (symmetric with the loader): one `Geometry` per SceneGeometry
 * (positions dequantised from quantised storage, per-vertex normals + UVs as
 * `ByVertice` layers, triangles via `PolygonVertexIndex`), one `Model` per
 * SceneMesh carrying its transform decomposed back to `Lcl Translation /
 * Rotation / Scaling`, a diffuse `Material` colour, and embedded diffuse
 * `Texture` + `Video` (image bytes inline). Geometry shared across meshes is
 * emitted once and instanced through the `Connections` graph.
 *
 * Not handled: the SceneModel `coordinateSystem` (geometry is emitted in its
 * stored space), vertex colours, non-colour texture slots, and matrices that
 * aren't a clean translation·rotation·scale (shear / negative scale).
 *
 * @internal
 */
import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import {octDecodeNormalsU16} from "../../../../base/math/compression";
import {findTriplanarTextureSkip, triplanarSkipWarning} from "../../../findTriplanarTextureSkip";
import {
  writeFBXBinary, fbxI, fbxL, fbxD, fbxS, fbxR, fbxDArr, fbxIArr, fbxNode, fbxLeaf,
  type FBXProp, type FBXWriteNode,
} from "../../fbxBinaryWriter";

const RAD2DEG = 180 / Math.PI;
const SEP = "\u0000\u0001";   // FBX "Name\0\x01Class" separator

export async function encode(params: ModelEncodeParams, options?: any): Promise<ArrayBuffer> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    throw "FBXExporter requires params.sceneModel";
  }
  const ignoreNormals = options?.ignoreNormals === true;
  const ignoreUVs = options?.ignoreUVs === true;

  // Triplanar (world-projected, UV-less) textures can't be expressed in FBX;
  // drop them and flatten the affected materials.
  const triplanarSkip = findTriplanarTextureSkip(sceneModel);
  if (triplanarSkip.any) {
    const warn = options?.onWarning ?? ((m: string) => console.warn(m));
    warn(triplanarSkipWarning("FBX", triplanarSkip));
  }

  let nextId = 1000;
  const newId = (): number => ++nextId;

  const objectsChildren: FBXWriteNode[] = [];
  const connections: FBXWriteNode[] = [];

  const geomFbxId = new Map<string, number>();   // SceneGeometry id -> FBX Geometry id
  const matFbxId = new Map<string, number>();    // SceneMaterial id -> FBX Material id
  const texFbxId = new Map<string, number>();    // SceneTexture id -> FBX Texture id (-1 = no bytes)
  const usedNames = new Set<string>();

  // Geometry — emitted once, shared across instancing meshes.
  function geometryId(geom: any): number | null {
    const existing = geomFbxId.get(geom.id);
    if (existing !== undefined) return existing;
    const node = buildGeometryNode(geom, newId(), ignoreNormals, ignoreUVs);
    if (!node) return null;
    geomFbxId.set(geom.id, node.props[0].v as number);
    objectsChildren.push(node);
    return node.props[0].v as number;
  }

  // Material — emitted once; pulls in its diffuse texture (if any).
  async function materialId(mat: any): Promise<number> {
    const existing = matFbxId.get(mat.id);
    if (existing !== undefined) return existing;
    const id = newId();
    matFbxId.set(mat.id, id);
    const c = mat.color || [1, 1, 1];
    objectsChildren.push(fbxNode("Material",
      [fbxL(id), fbxS(`${mat.id}${SEP}Material`), fbxS("")],
      [fbxNode("Properties70", [], [pNode("DiffuseColor", "Color", [c[0], c[1], c[2]])])],
    ));
    await emitTexture(mat, id);
    return id;
  }

  // Diffuse texture — a Video carrying the embedded image bytes plus a Texture,
  // wired Texture→Material ("DiffuseColor") and Video→Texture. A SceneTexture
  // shared by several materials is emitted once and connected to each.
  async function emitTexture(mat: any, matFbx: number): Promise<void> {
    if (triplanarSkip.materialIds.has(mat.id)) return; // triplanar — UV-less, FBX can't sample it
    const tex = mat.colorTexture;
    if (!tex) return;

    let texId = texFbxId.get(tex.id);
    if (texId === undefined) {
      const bytes = await textureBytes(tex);
      if (!bytes) {
        console.warn(`[FBXExporter] texture '${tex.id}' has no encodable image data; skipping.`);
        texFbxId.set(tex.id, -1);
        return;
      }
      texId = newId();
      const videoId = newId();
      const name = `${tex.id}.png`;
      objectsChildren.push(fbxNode("Video",
        [fbxL(videoId), fbxS(`${tex.id}${SEP}Video`), fbxS("Clip")],
        [fbxLeaf("Content", fbxR(bytes)), fbxLeaf("RelativeFilename", fbxS(name))],
      ));
      objectsChildren.push(fbxNode("Texture",
        [fbxL(texId), fbxS(`${tex.id}${SEP}Texture`), fbxS("")],
        [fbxLeaf("RelativeFilename", fbxS(name))],
      ));
      connections.push(connOO(videoId, texId));
      texFbxId.set(tex.id, texId);
    }
    if (texId < 0) return;   // tried before, no bytes
    connections.push(connOP(texId, matFbx, "DiffuseColor"));
  }

  // One Model per SceneMesh, named after its owning SceneObject so the loader
  // recovers the object id.
  for (const objectId in sceneModel.objects) {
    const sceneObject = sceneModel.objects[objectId];
    for (const mesh of sceneObject.meshes) {
      const geom = mesh.geometry;
      if (!geom) continue;
      const gId = geometryId(geom);
      if (gId === null) continue;

      const modelId = newId();
      let name = objectId;
      while (usedNames.has(name)) name = `${objectId}_${modelId}`;
      usedNames.add(name);

      const {t, r, s} = decomposeTRS(mesh.matrix);
      objectsChildren.push(fbxNode("Model",
        [fbxL(modelId), fbxS(`${name}${SEP}Model`), fbxS("Mesh")],
        [fbxNode("Properties70", [], [
          pNode("Lcl Translation", "Lcl Translation", t),
          pNode("Lcl Rotation", "Lcl Rotation", r),
          pNode("Lcl Scaling", "Lcl Scaling", s),
        ])],
      ));

      connections.push(connOO(gId, modelId));        // Geometry → Model
      if (mesh.material) {
        connections.push(connOO(await materialId(mesh.material), modelId));   // Material → Model
      }
      connections.push(connOO(modelId, 0));          // Model → scene root
    }
  }

  return writeFBXBinary([
    fbxNode("Objects", [], objectsChildren),
    fbxNode("Connections", [], connections),
  ]);
}


// ── Node builders ─────────────────────────────────────────────────

function buildGeometryNode(geom: any, id: number, ignoreNormals: boolean, ignoreUVs: boolean): FBXWriteNode | null {
  const pc = geom.positionsCompressed;
  const aabb = geom.aabb;
  if (!pc || !aabb || pc.length === 0) return null;

  // Positions: dequantise int16 → float using the geometry's AABB.
  const positions = new Float64Array(pc.length);
  const tmp: [number, number, number] = [0, 0, 0];
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < pc.length; i += 3) {
    tmp[0] = pc[i]; tmp[1] = pc[i + 1]; tmp[2] = pc[i + 2];
    decompressPoint3WithAABB3(tmp, aabb, out);
    positions[i] = out[0]; positions[i + 1] = out[1]; positions[i + 2] = out[2];
  }

  // Triangles → PolygonVertexIndex (last corner of each triangle negated).
  const numVerts = pc.length / 3;
  const idx = geom.indices ?? sequential(numVerts);
  const poly = new Int32Array(idx.length);
  for (let i = 0; i + 2 < idx.length; i += 3) {
    poly[i] = idx[i];
    poly[i + 1] = idx[i + 1];
    poly[i + 2] = -(idx[i + 2] + 1);
  }

  const children: FBXWriteNode[] = [
    fbxLeaf("Vertices", fbxDArr(positions)),
    fbxLeaf("PolygonVertexIndex", fbxIArr(poly)),
  ];

  if (!ignoreNormals && geom.normalsCompressed) {
    const normals = new Float32Array((geom.normalsCompressed.length / 2) * 3);
    octDecodeNormalsU16(geom.normalsCompressed, normals);
    children.push(layerNode("LayerElementNormal", "Normals", normals));
  }
  if (!ignoreUVs && geom.uvsCompressed && geom.uvsCompressed.length) {
    // UVs are stored as raw RG32F floats (no quantisation) — emit directly.
    children.push(layerNode("LayerElementUV", "UV", geom.uvsCompressed));
  }

  return fbxNode("Geometry", [fbxL(id), fbxS(`${geom.id}${SEP}Geometry`), fbxS("Mesh")], children);
}

/** A `ByVertice` / `Direct` layer (one datum per control point). */
function layerNode(layerName: string, dataName: string, data: ArrayLike<number>): FBXWriteNode {
  return fbxNode(layerName, [fbxI(0)], [
    fbxLeaf("MappingInformationType", fbxS("ByVertice")),
    fbxLeaf("ReferenceInformationType", fbxS("Direct")),
    fbxLeaf(dataName, fbxDArr(data)),
  ]);
}

/** A `Properties70` `P` entry: 4 string tags then the numeric values. */
function pNode(name: string, type: string, vals: ArrayLike<number>): FBXWriteNode {
  const props: FBXProp[] = [fbxS(name), fbxS(type), fbxS(""), fbxS("A")];
  for (let i = 0; i < vals.length; i++) props.push(fbxD(vals[i]));
  return fbxNode("P", props);
}

function connOO(childId: number, parentId: number): FBXWriteNode {
  return fbxNode("C", [fbxS("OO"), fbxL(childId), fbxL(parentId)]);
}
function connOP(childId: number, parentId: number, prop: string): FBXWriteNode {
  return fbxNode("C", [fbxS("OP"), fbxL(childId), fbxL(parentId), fbxS(prop)]);
}

function sequential(n: number): Int32Array<any> {
  const a = new Int32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return a;
}


// ── Dequantisation (inlined to keep the encoder free of the base/math
//    barrel, whose load order trips jest — same reason as the loader) ──

/** int16 → float position via the geometry's AABB. */
function decompressPoint3WithAABB3(p: ArrayLike<number>, aabb: ArrayLike<number>, dest: number[]): void {
  dest[0] = p[0] * ((aabb[3] - aabb[0]) / 65535) + aabb[0];
  dest[1] = p[1] * ((aabb[4] - aabb[1]) / 65535) + aabb[1];
  dest[2] = p[2] * ((aabb[5] - aabb[2]) / 65535) + aabb[2];
}


// ── Transform decomposition ───────────────────────────────────────

/**
 * Splits a column-major 4×4 into translation, Euler rotation (degrees, XYZ
 * order) and scale — the inverse of the loader's `composeTRS`
 * (`M = T·Rz·Ry·Rx·S`). Correct for clean TRS matrices; shear / negative scale
 * aren't recovered.
 */
function decomposeTRS(m: ArrayLike<number>): {t: number[]; r: number[]; s: number[]} {
  const sx = Math.hypot(m[0], m[1], m[2]) || 1;
  const sy = Math.hypot(m[4], m[5], m[6]) || 1;
  const sz = Math.hypot(m[8], m[9], m[10]) || 1;

  const r00 = m[0] / sx, r10 = m[1] / sx, r20 = m[2] / sx;
  const r21 = m[6] / sy;
  const r22 = m[10] / sz;

  const ry = Math.asin(Math.max(-1, Math.min(1, -r20)));
  let rx: number, rz: number;
  if (Math.abs(r20) < 0.9999999) {
    rx = Math.atan2(r21, r22);
    rz = Math.atan2(r10, r00);
  } else {
    // Gimbal lock (ry ≈ ±90°): fold the X/Z rotation together.
    rx = Math.atan2(-m[9] / sz, m[5] / sy);
    rz = 0;
  }

  return {
    t: [m[12], m[13], m[14]],
    r: [rx * RAD2DEG, ry * RAD2DEG, rz * RAD2DEG],
    s: [sx, sy, sz],
  };
}


// ── Texture image bytes ───────────────────────────────────────────

/** Encoded image bytes for a SceneTexture, or null when none can be produced. */
async function textureBytes(tex: any): Promise<Uint8Array<any> | null> {
  if (tex.buffers && tex.buffers[0]) {
    return new Uint8Array(tex.buffers[0]);
  }
  if (typeof tex.src === "string" && tex.src.startsWith("data:")) {
    const comma = tex.src.indexOf(",");
    if (comma >= 0) return base64ToBytes(tex.src.slice(comma + 1));
  }
  const source = tex.image ?? tex.imageData;
  if (source && typeof document !== "undefined") {
    try { return await canvasEncodePNG(source); } catch { /* fall through */ }
  }
  return null;
}

function base64ToBytes(b64: string): Uint8Array<any> {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array((globalThis as any).Buffer.from(b64, "base64"));
}

async function canvasEncodePNG(source: any): Promise<Uint8Array<any>> {
  const w = source.width, h = source.height;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  if (typeof ImageData !== "undefined" && source instanceof ImageData) {
    ctx.putImageData(source, 0, 0);
  } else {
    ctx.drawImage(source, 0, 0);
  }
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej("toBlob failed"), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}
