/**
 * 3DXML v1 parse pipeline: ZIP → Manifest → product structure → tessellated
 * representations → SceneModel.
 *
 *   Manifest.xml ──► <Root> names the product-structure (model) file
 *        │
 *        ▼
 *   product structure ──► assembly graph (Reference3D / Instance3D / ReferenceRep)
 *        │
 *        ▼
 *   traverse from root, composing RelativeMatrix transforms ──► flat instances
 *        │
 *        ▼
 *   each ReferenceRep's associatedFile ──► triangle geometry (parsed once, reused)
 *        │
 *        ▼
 *   per instance: one SceneMesh per geometry (baked world matrix) + one SceneObject
 *
 * @internal
 */
import type {ModelParseParams} from "../../../ModelParseParams";
import type {ModelLoadOptions} from "../../../ModelLoadOptions";
import {TrianglesPrimitive} from "../../../../base/constants";
import {createMat4Float64, mulMat4, type Mat4} from "../../../../base/math/matrix";
import {entryText, isZip, unzip, type ZipArchive} from "../../unzip";
import {parseXML, textOf} from "./xml";
import {parseProductStructure} from "./parseProductStructure";
import {parseRepresentation} from "./parseRepresentation";
import type {ProductStructure} from "./types";

const IDENTITY: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const MAX_DEPTH = 512;

/** A flattened occurrence of a ReferenceRep at a baked world matrix. */
interface RepInstance {
  refRepId: string;
  matrix: Mat4 | number[];
  path: string;
}

/** A created geometry + its flat colour, cached per ReferenceRep (instancing). */
interface RepGeom {
  geometryId: string;
  color?: [number, number, number, number];
}

export async function parse(params: ModelParseParams, _options?: ModelLoadOptions): Promise<void> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    return;
  }
  const fileData = params.fileData;
  if (!(fileData instanceof ArrayBuffer) || !isZip(fileData)) {
    throw new Error("[3DXMLLoader] fileData is not a .3dxml ZIP archive");
  }

  const archive = unzip(fileData);

  // ── Manifest → product-structure (model) document ──────────────────────────
  const manifestName = findEntry(archive, "Manifest.xml");
  if (!manifestName) {
    throw new Error("[3DXMLLoader] archive has no Manifest.xml");
  }
  const root = textOf(parseXML(entryText(archive, manifestName)!), "Root");
  const modelName = root ? resolveEntry(archive, root) : null;
  if (!modelName) {
    throw new Error(`[3DXMLLoader] manifest Root '${root ?? ""}' not found in archive`);
  }

  const structure = parseProductStructure(parseXML(entryText(archive, modelName)!));

  // ── Traverse the assembly, baking world matrices ───────────────────────────
  const instances = flattenInstances(structure);

  // ── Emit: geometry once per ReferenceRep, mesh + object per instance ────────
  const repGeomCache = new Map<string, RepGeom[]>();
  let objectCount = 0;

  for (const inst of instances) {
    const geoms = ensureRepGeometries(inst.refRepId, structure, archive, sceneModel, repGeomCache);
    if (geoms.length === 0) {
      continue;
    }
    const objectId = `object-${objectCount++}`;
    const meshIds: string[] = [];
    for (let i = 0; i < geoms.length; i++) {
      const meshId = `${objectId}-mesh-${i}`;
      const meshParams: any = {id: meshId, geometryId: geoms[i].geometryId, matrix: inst.matrix};
      const color = geoms[i].color;
      if (color) {
        meshParams.color = [color[0], color[1], color[2]];
        meshParams.opacity = color[3];
      }
      if (sceneModel.createMesh(meshParams).ok !== false) {
        meshIds.push(meshId);
      }
    }
    if (meshIds.length > 0) {
      sceneModel.createObject({id: objectId, originalSystemId: inst.path, meshIds});
    }
  }
}

/** Walks Reference3D / Instance3D / InstanceRep from the root, composing transforms. */
function flattenInstances(structure: ProductStructure): RepInstance[] {
  const instRepsByRef = groupBy(structure.instanceReps, ir => ir.aggregatedBy);
  const inst3DsByRef = groupBy(structure.instance3Ds, i => i.aggregatedBy);
  const instances: RepInstance[] = [];

  const visit = (refId: string, world: Mat4 | number[], path: string, onPath: Set<string>, depth: number): void => {
    if (depth > MAX_DEPTH || onPath.has(refId)) {
      return;   // cycle guard / runaway depth
    }
    onPath.add(refId);
    for (const ir of instRepsByRef.get(refId) ?? []) {
      instances.push({refRepId: ir.instanceOf, matrix: world, path: `${path}/${ir.id}`});
    }
    for (const i3 of inst3DsByRef.get(refId) ?? []) {
      const childWorld = mulMat4(world as Mat4, i3.matrix as Mat4, createMat4Float64());
      visit(i3.instanceOf, childWorld, `${path}/${i3.id}`, onPath, depth + 1);
    }
    onPath.delete(refId);
  };

  visit(structure.rootRef, IDENTITY, "root", new Set<string>(), 0);
  return instances;
}

/** Parses a ReferenceRep's geometry once and creates its SceneGeometries, caching the result. */
function ensureRepGeometries(
  refRepId: string, structure: ProductStructure, archive: ZipArchive, sceneModel: any, cache: Map<string, RepGeom[]>,
): RepGeom[] {
  const cached = cache.get(refRepId);
  if (cached) {
    return cached;
  }
  const out: RepGeom[] = [];
  cache.set(refRepId, out);   // set first so a missing rep is cached as empty

  const refRep = structure.referenceReps.get(refRepId);
  const entry = refRep?.associatedFile ? resolveEntry(archive, refRep.associatedFile) : null;
  if (!entry) {
    return out;
  }
  const text = entryText(archive, entry);
  if (!text) {
    return out;
  }

  const geoms = parseRepresentation(parseXML(text));
  for (let i = 0; i < geoms.length; i++) {
    const g = geoms[i];
    const geometryId = `geom-${refRepId}-${i}`;
    const res = sceneModel.createGeometry({
      id: geometryId,
      primitive: TrianglesPrimitive,
      positions: g.positions,
      normals: g.normals,
      indices: g.indices,
    });
    if (res.ok !== false) {
      out.push({geometryId, color: g.color});
    }
  }
  return out;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) {
      arr.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}

/** Case-insensitive lookup of a well-known entry by basename (e.g. `Manifest.xml`). */
function findEntry(archive: ZipArchive, basename: string): string | null {
  const lower = basename.toLowerCase();
  for (const n of archive.names) {
    if (n.toLowerCase() === lower || n.toLowerCase().endsWith(`/${lower}`)) {
      return n;
    }
  }
  return null;
}

/**
 * Resolves a 3DXML reference (a plain filename, a path, or a `urn:…:name` form)
 * to an actual archive entry, falling back to a basename / case-insensitive match.
 */
function resolveEntry(archive: ZipArchive, ref: string): string | null {
  if (archive.byName.has(ref)) {
    return ref;
  }
  const base = lastSegment(ref);
  if (archive.byName.has(base)) {
    return base;
  }
  for (const n of archive.names) {
    if (n.endsWith(`/${base}`) || lastSegment(n) === base) {
      return n;
    }
  }
  const lb = base.toLowerCase();
  for (const n of archive.names) {
    if (lastSegment(n).toLowerCase() === lb) {
      return n;
    }
  }
  return null;
}

/** The trailing segment after the last `/`, `\` or `:` (so `urn:…:file.3DRep` → `file.3DRep`). */
function lastSegment(s: string): string {
  const cut = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"), s.lastIndexOf(":"));
  return cut >= 0 ? s.slice(cut + 1) : s;
}
