/**
 * Parses a binary FBX document into a {@link model!scene.SceneModel | SceneModel}.
 *
 * v1 scope: mesh geometry (control points + polygon triangulation, per-vertex
 * normals and UVs), each `Model`'s local transform (`Lcl Translation /
 * Rotation / Scaling`), and a basic diffuse `Material` colour. The
 * Geometry↔Model↔Material wiring comes from the FBX `Connections` graph.
 *
 * Not handled (yet): ASCII FBX, animation, skinning / deformers, NURBS,
 * textures / embedded media, and the full pivot / pre-post-rotation transform
 * chain (only TRS is applied). Geometry is emitted expanded (non-indexed) per
 * triangle corner — simple and correct; vertex sharing is a later optimisation.
 *
 * @internal
 */
import {TrianglesPrimitive} from "../../../../base/constants";
import type {ModelParseParams} from "../../../ModelParseParams";
import {readFBXBinary} from "../../fbxBinaryReader";
import {findChild, type FBXNode} from "../../FBXNode";

const DEG2RAD = Math.PI / 180;

export async function parse(params: ModelParseParams, _options?: any): Promise<void> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    return;
  }

  const root = readFBXBinary(params.fileData as ArrayBuffer);
  const objectsNode = findChild(root, "Objects");
  if (!objectsNode) {
    console.warn("[FBXLoader] No Objects node — nothing to load.");
    return;
  }
  const connectionsNode = findChild(root, "Connections");

  // Index the typed objects by their FBX id (the first property).
  const geometries = new Map<number, FBXNode>();
  const models = new Map<number, FBXNode>();
  const materials = new Map<number, FBXNode>();
  for (const child of objectsNode.children) {
    const id = child.props[0] as number;
    if (child.name === "Geometry") geometries.set(id, child);
    else if (child.name === "Model") models.set(id, child);
    else if (child.name === "Material") materials.set(id, child);
  }

  // Connection graph: parentId -> [childId, ...]. Each `C` is
  // [relType, childId, parentId, (propName)].
  const childIdsOf = new Map<number, number[]>();
  if (connectionsNode) {
    for (const c of connectionsNode.children) {
      if (c.name !== "C") continue;
      const childId = c.props[1] as number;
      const parentId = c.props[2] as number;
      let arr = childIdsOf.get(parentId);
      if (!arr) childIdsOf.set(parentId, arr = []);
      arr.push(childId);
    }
  }

  const emittedGeom = new Map<number, string>();    // fbx geom id -> SceneModel geometry id
  const emittedMat = new Map<number, string>();     // fbx material id -> SceneModel material id
  const usedObjectIds = new Set<string>();
  let emitted = 0, geomFails = 0, meshFails = 0;

  for (const [modelId, modelNode] of models) {
    const children = childIdsOf.get(modelId) || [];
    let geomId: number | null = null;
    let matId: number | null = null;
    for (const cid of children) {
      if (geometries.has(cid)) geomId = cid;
      else if (materials.has(cid)) matId = cid;
    }
    if (geomId === null) {
      continue;   // a non-mesh Model (camera, light, null/group) — skip
    }

    // Geometry — created once per FBX geometry, shared across instancing Models.
    let geometryId = emittedGeom.get(geomId);
    if (geometryId === undefined) {
      const geo = extractGeometry(geometries.get(geomId)!);
      if (!geo) continue;
      geometryId = `fbx-geom-${geomId}`;
      const gr = sceneModel.createGeometry({
        id: geometryId,
        primitive: TrianglesPrimitive,
        positions: geo.positions,
        normals: geo.normals,
        uvs: geo.uvs,
        indices: geo.indices,
      });
      if ((gr as any).ok === false) {
        if (++geomFails <= 3) console.warn("[FBXLoader] createGeometry failed:", (gr as any).error);
        continue;
      }
      emittedGeom.set(geomId, geometryId);
    }

    // Material — basic diffuse colour, created once per FBX material.
    let materialId: string | undefined;
    if (matId !== null) {
      materialId = emittedMat.get(matId);
      if (materialId === undefined) {
        const id = `fbx-mat-${matId}`;
        const mr = sceneModel.createMaterial({id, color: extractDiffuse(materials.get(matId)!)});
        if ((mr as any).ok === false) {
          materialId = undefined;
        } else {
          materialId = id;
          emittedMat.set(matId, id);
        }
      }
    }

    const meshId = `fbx-mesh-${modelId}`;
    const mr = sceneModel.createMesh({
      id: meshId,
      geometryId,
      materialId,
      matrix: extractModelMatrix(modelNode),
    });
    if ((mr as any).ok === false) {
      if (++meshFails <= 3) console.warn("[FBXLoader] createMesh failed:", (mr as any).error);
      continue;
    }

    sceneModel.createObject({id: modelObjectId(modelNode, modelId, usedObjectIds), meshIds: [meshId]});
    emitted++;
  }

  if (emitted === 0) {
    console.warn("[FBXLoader] No mesh models were emitted from the FBX.");
  }
}


// ── Geometry extraction ───────────────────────────────────────────

interface ExtractedGeometry {
  positions: Float32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  indices: Uint32Array;
}

function extractGeometry(geomNode: FBXNode): ExtractedGeometry | null {
  const verts = arrayProp(findChild(geomNode, "Vertices"));
  const polys = arrayProp(findChild(geomNode, "PolygonVertexIndex"));
  if (!verts || !polys || verts.length === 0 || polys.length === 0) {
    return null;
  }

  const normLayer = readLayer(geomNode, "LayerElementNormal", "Normals", "NormalsIndex");
  const uvLayer = readLayer(geomNode, "LayerElementUV", "UV", "UVIndex");

  const positions: number[] = [];
  const normals: number[] | null = normLayer ? [] : null;
  const uvs: number[] | null = uvLayer ? [] : null;

  // Walk each polygon (a negative index marks its last corner), fan-triangulate,
  // and emit expanded corners.
  let i = 0;
  while (i < polys.length) {
    const corners: Array<{cp: number; pvi: number}> = [];
    let j = i;
    for (; j < polys.length; j++) {
      const raw = polys[j];
      const cp = raw < 0 ? (-raw - 1) : raw;
      corners.push({cp, pvi: j});
      if (raw < 0) { j++; break; }
    }
    for (let k = 1; k + 1 < corners.length; k++) {
      for (const c of [corners[0], corners[k], corners[k + 1]]) {
        positions.push(verts[c.cp * 3], verts[c.cp * 3 + 1], verts[c.cp * 3 + 2]);
        if (normals) {
          const nrm = lookupVec(normLayer!, c.pvi, c.cp, 3) || [0, 0, 1];
          normals.push(nrm[0], nrm[1], nrm[2]);
        }
        if (uvs) {
          const uv = lookupVec(uvLayer!, c.pvi, c.cp, 2) || [0, 0];
          uvs.push(uv[0], uv[1]);
        }
      }
    }
    i = j;
  }

  const count = positions.length / 3;
  if (count === 0) {
    return null;
  }
  const indices = new Uint32Array(count);
  for (let k = 0; k < count; k++) indices[k] = k;

  return {
    positions: new Float32Array(positions),
    normals: normals ? new Float32Array(normals) : undefined,
    uvs: uvs ? new Float32Array(uvs) : undefined,
    indices,
  };
}

interface Layer {
  data: ArrayLike<number>;
  mapping: string;
  reference: string;
  index: ArrayLike<number> | null;
}

function readLayer(geomNode: FBXNode, layerName: string, dataName: string, indexName: string): Layer | null {
  const layer = findChild(geomNode, layerName);
  if (!layer) return null;
  const data = arrayProp(findChild(layer, dataName));
  if (!data) return null;
  return {
    data,
    mapping: String(scalarProp(findChild(layer, "MappingInformationType")) ?? "ByPolygonVertex"),
    reference: String(scalarProp(findChild(layer, "ReferenceInformationType")) ?? "Direct"),
    index: arrayProp(findChild(layer, indexName)),
  };
}

function lookupVec(layer: Layer, pvi: number, cp: number, size: number): number[] | null {
  let i: number;
  const m = layer.mapping;
  if (m === "ByControlPoint" || m === "ByVertex" || m === "ByVertice") i = cp;
  else if (m === "AllSame") i = 0;
  else i = pvi;   // ByPolygonVertex (FBX default)
  if ((layer.reference === "IndexToDirect" || layer.reference === "Index") && layer.index) {
    i = layer.index[i];
  }
  const out: number[] = new Array(size);
  for (let k = 0; k < size; k++) out[k] = layer.data[i * size + k];
  return out;
}


// ── Transform & material ──────────────────────────────────────────

function extractModelMatrix(modelNode: FBXNode): Float64Array {
  const t = prop70(modelNode, "Lcl Translation") || [0, 0, 0];
  const r = prop70(modelNode, "Lcl Rotation") || [0, 0, 0];
  const s = prop70(modelNode, "Lcl Scaling") || [1, 1, 1];
  return composeTRS(
    t[0] || 0, t[1] || 0, t[2] || 0,
    (r[0] || 0) * DEG2RAD, (r[1] || 0) * DEG2RAD, (r[2] || 0) * DEG2RAD,
    s[0] ?? 1, s[1] ?? 1, s[2] ?? 1,
  );
}

/**
 * Column-major 4×4 from translation, Euler rotation (radians, XYZ order), and
 * scale: `M = T · Rz · Ry · Rx · S`. Inlined to keep the loader free of the
 * base/math barrel.
 */
function composeTRS(
  tx: number, ty: number, tz: number,
  rx: number, ry: number, rz: number,
  sx: number, sy: number, sz: number,
): Float64Array {
  const cx = Math.cos(rx), sxr = Math.sin(rx);
  const cy = Math.cos(ry), syr = Math.sin(ry);
  const cz = Math.cos(rz), szr = Math.sin(rz);

  // Rotation R = Rz·Ry·Rx (rotate about X, then Y, then Z).
  const r00 = cy * cz;
  const r01 = sxr * syr * cz - cx * szr;
  const r02 = cx * syr * cz + sxr * szr;
  const r10 = cy * szr;
  const r11 = sxr * syr * szr + cx * cz;
  const r12 = cx * syr * szr - sxr * cz;
  const r20 = -syr;
  const r21 = sxr * cy;
  const r22 = cx * cy;

  const m = new Float64Array(16);
  m[0] = r00 * sx;  m[1] = r10 * sx;  m[2]  = r20 * sx;  m[3]  = 0;
  m[4] = r01 * sy;  m[5] = r11 * sy;  m[6]  = r21 * sy;  m[7]  = 0;
  m[8] = r02 * sz;  m[9] = r12 * sz;  m[10] = r22 * sz;  m[11] = 0;
  m[12] = tx;       m[13] = ty;       m[14] = tz;        m[15] = 1;
  return m;
}

function extractDiffuse(matNode: FBXNode): [number, number, number] {
  const c = prop70(matNode, "DiffuseColor") || prop70(matNode, "Diffuse");
  if (c && c.length >= 3) return [c[0], c[1], c[2]];
  return [0.7, 0.7, 0.7];
}

/** Reads a `Properties70` `P` entry's numeric values (those after the 4 tags). */
function prop70(node: FBXNode, name: string): number[] | null {
  const props70 = findChild(node, "Properties70");
  if (!props70) return null;
  for (const p of props70.children) {
    if (p.name === "P" && p.props[0] === name) {
      return p.props.slice(4).map(Number);
    }
  }
  return null;
}

/** Object id from the Model's `"Name\0\x01Model"` property, made unique. */
function modelObjectId(modelNode: FBXNode, modelId: number, used: Set<string>): string {
  const raw = String(modelNode.props[1] ?? "");
  let name = (raw.split("\0\x01")[0] || "").trim() || `fbx-obj-${modelId}`;
  let id = name;
  let n = 1;
  while (used.has(id)) id = `${name}_${n++}`;
  used.add(id);
  return id;
}

function arrayProp(node: FBXNode | undefined): ArrayLike<number> | null {
  if (!node || node.props.length === 0) return null;
  const v = node.props[0];
  return (v && typeof v.length === "number" && typeof v !== "string") ? v : null;
}

function scalarProp(node: FBXNode | undefined): any {
  return node && node.props.length > 0 ? node.props[0] : undefined;
}
