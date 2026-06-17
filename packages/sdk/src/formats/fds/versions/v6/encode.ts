import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import type {DataModel} from "../../../../model/data/DataModel";
import type {DataObject} from "../../../../model/data/DataObject";
import type {PropertySet} from "../../../../model/data/PropertySet";
import type {Property} from "../../../../model/data/Property";

/**
 * Encodes an FDS-shaped {@link DataModel} back into v6 namelist text.
 *
 * The encoder walks the typed FDS DataObjects produced by
 * {@link buildDataModel} — `FDSProject`, `FDSSurface`, `FDSMesh`,
 * `FDSObstruction`, `FDSVent`, `FDSHole` — and emits one namelist
 * record per object. Element ↔ surface linking comes from the
 * `usesSurface` Relationship; XB / IJK / MB / IOR come from the
 * `Geometry` PropertySet; every other parameter comes from the
 * `FDS` PropertySet, which preserves the original namelist
 * parameters verbatim.
 *
 * The DataModel is the canonical source. The SceneModel — if
 * supplied — is ignored by the v1 encoder; for FDS the typed graph
 * already carries the authored XB exactly, while reconstituting it
 * from hole-cut SceneMesh remainders would be lossy.
 *
 * @internal
 */
export async function encode(params: ModelEncodeParams, _options?: any): Promise<string> {
  const {dataModel} = params;
  if (!dataModel) {
    throw new Error("[FDS/v6/encode] expected dataModel in params");
  }

  const lines: string[] = [];

  // ── HEAD (zero or one per file) ──────────────────────────────
  const project = findFirstOfType(dataModel, "FDSProject");
  if (project) {
    const head = headFromProject(project);
    if (head.length > 0) {
      lines.push(`&HEAD ${head.join(", ")} /`);
    }
    lines.push("");
  }

  // ── SURF records ─────────────────────────────────────────────
  const surfs = collectByType(dataModel, "FDSSurface");
  if (surfs.length > 0) {
    for (const s of surfs) lines.push(emitSurf(s));
    lines.push("");
  }

  // ── MESH records ─────────────────────────────────────────────
  const meshes = collectByType(dataModel, "FDSMesh");
  if (meshes.length > 0) {
    for (const m of meshes) lines.push(emitMesh(m));
    lines.push("");
  }

  // ── OBST / VENT / HOLE ───────────────────────────────────────
  // Preserve insertion order within each type so a load → encode →
  // load round-trip emits records in source order.
  const obsts = collectByType(dataModel, "FDSObstruction");
  for (const o of obsts) lines.push(emitObst(o));
  if (obsts.length > 0) lines.push("");

  const vents = collectByType(dataModel, "FDSVent");
  for (const v of vents) lines.push(emitVent(v));
  if (vents.length > 0) lines.push("");

  const holes = collectByType(dataModel, "FDSHole");
  for (const h of holes) lines.push(emitHole(h));
  if (holes.length > 0) lines.push("");

  // Tail newline so the file ends cleanly.
  return lines.join("\n") + "\n";
}


// ─────────── per-group emitters ───────────

function headFromProject(project: DataObject): string[] {
  const out: string[] = [];
  // Project name was set from TITLE (or CHID, or modelId) at load time.
  // We can't reliably distinguish which without more state, so write it
  // as TITLE. A round-tripped load also tolerated missing CHID/TITLE.
  if (project.name) out.push(`TITLE=${quote(project.name)}`);
  return out;
}

function emitSurf(surf: DataObject): string {
  const fds = pset(surf, "FDS");
  const parts: string[] = [`ID=${quote(surf.name ?? surf.id)}`];
  emitIfNumberArray(parts, fds, "RGB");
  emitIfString(parts, fds, "COLOR");
  emitIfReal(parts, fds, "TRANSPARENCY");
  emitExtras(parts, fds, ["RGB", "COLOR", "TRANSPARENCY"]);
  return `&SURF ${parts.join(", ")} /`;
}

function emitMesh(mesh: DataObject): string {
  const geom = pset(mesh, "Geometry");
  const parts: string[] = [];
  if (mesh.name) parts.push(`ID=${quote(mesh.name)}`);
  const ijk = readIJK(geom);
  if (ijk) parts.push(`IJK=${ijk.join(",")}`);
  const xb = readXB(geom);
  if (xb) parts.push(`XB=${xb.map(formatReal).join(",")}`);
  return `&MESH ${parts.join(", ")} /`;
}

function emitObst(obst: DataObject): string {
  const geom = pset(obst, "Geometry");
  const fds = pset(obst, "FDS");
  const parts: string[] = [];
  if (obst.name && !isSyntheticName(obst.name, "Obstruction")) {
    parts.push(`ID=${quote(obst.name)}`);
  }
  const xb = readXB(geom);
  if (xb) parts.push(`XB=${xb.map(formatReal).join(",")}`);
  emitIfNumberArray(parts, fds, "RGB");
  emitIfString(parts, fds, "COLOR");
  const surfId = surfIdOf(obst);
  if (surfId) parts.push(`SURF_ID=${quote(surfId)}`);
  emitExtras(parts, fds, ["RGB", "COLOR"]);
  return `&OBST ${parts.join(", ")} /`;
}

function emitVent(vent: DataObject): string {
  const geom = pset(vent, "Geometry");
  const fds = pset(vent, "FDS");
  const parts: string[] = [];
  if (vent.name && !isSyntheticName(vent.name, "Vent")) {
    parts.push(`ID=${quote(vent.name)}`);
  }
  const xb = readXB(geom);
  if (xb) parts.push(`XB=${xb.map(formatReal).join(",")}`);
  const mb = readString(geom, "MB");
  if (mb !== undefined) parts.push(`MB=${quote(mb)}`);
  const ior = readReal(geom, "IOR");
  if (ior !== undefined) parts.push(`IOR=${ior}`);
  emitIfNumberArray(parts, fds, "RGB");
  emitIfString(parts, fds, "COLOR");
  const surfId = surfIdOf(vent);
  if (surfId) parts.push(`SURF_ID=${quote(surfId)}`);
  emitExtras(parts, fds, ["RGB", "COLOR"]);
  return `&VENT ${parts.join(", ")} /`;
}

function emitHole(hole: DataObject): string {
  const geom = pset(hole, "Geometry");
  const fds = pset(hole, "FDS");
  const parts: string[] = [];
  if (hole.name && !isSyntheticName(hole.name, "Hole")) {
    parts.push(`ID=${quote(hole.name)}`);
  }
  const xb = readXB(geom);
  if (xb) parts.push(`XB=${xb.map(formatReal).join(",")}`);
  emitExtras(parts, fds, []);
  return `&HOLE ${parts.join(", ")} /`;
}


// ─────────── DataModel walk helpers ───────────

function collectByType(dataModel: DataModel, type: string): DataObject[] {
  const out: DataObject[] = [];
  for (const id in dataModel.objects) {
    const obj = dataModel.objects[id];
    if (obj.type === type) out.push(obj);
  }
  return out;
}

function findFirstOfType(dataModel: DataModel, type: string): DataObject | undefined {
  for (const id in dataModel.objects) {
    const obj = dataModel.objects[id];
    if (obj.type === type) return obj;
  }
  return undefined;
}

function pset(obj: DataObject, name: string): PropertySet | undefined {
  if (!obj.propertySets) return undefined;
  for (const ps of obj.propertySets) {
    if (ps.name === name) return ps;
  }
  return undefined;
}

function prop(ps: PropertySet | undefined, name: string): Property | undefined {
  if (!ps) return undefined;
  for (const p of ps.properties) {
    if (p.name === name) return p;
  }
  return undefined;
}

function readReal(ps: PropertySet | undefined, name: string): number | undefined {
  const p = prop(ps, name);
  return p && typeof p.value === "number" && Number.isFinite(p.value) ? p.value : undefined;
}

function readString(ps: PropertySet | undefined, name: string): string | undefined {
  const p = prop(ps, name);
  return p && typeof p.value === "string" ? p.value : undefined;
}

function readXB(ps: PropertySet | undefined): readonly [number, number, number, number, number, number] | undefined {
  const xmin = readReal(ps, "XMIN");
  const xmax = readReal(ps, "XMAX");
  const ymin = readReal(ps, "YMIN");
  const ymax = readReal(ps, "YMAX");
  const zmin = readReal(ps, "ZMIN");
  const zmax = readReal(ps, "ZMAX");
  if (xmin === undefined || xmax === undefined ||
      ymin === undefined || ymax === undefined ||
      zmin === undefined || zmax === undefined) return undefined;
  return [xmin, xmax, ymin, ymax, zmin, zmax];
}

function readIJK(ps: PropertySet | undefined): readonly [number, number, number] | undefined {
  const i = readReal(ps, "I");
  const j = readReal(ps, "J");
  const k = readReal(ps, "K");
  if (i === undefined || j === undefined || k === undefined) return undefined;
  return [i, j, k];
}

/**
 * SURF_ID via the element's outgoing `usesSurface` relationship.
 *
 * Note: `DataModel.createRelationship` files the relationship under
 * `relatingObject.related[type]` (not `relatingObject.relating[type]`
 * as the field name might suggest). So from the element's side the
 * outgoing edge lives in `element.related["usesSurface"]`.
 */
function surfIdOf(element: DataObject): string | undefined {
  const rels = (element.related as any)?.usesSurface;
  if (!rels) return undefined;
  const list: any[] = Array.isArray(rels) ? rels : [rels];
  for (const rel of list) {
    const tgt = rel?.relatedObject;
    if (tgt?.type === "FDSSurface") return tgt.name ?? undefined;
  }
  return undefined;
}


// ─────────── value formatting ───────────

function quote(s: string): string {
  // FDS single-quote strings; the format has no documented escape, so
  // a literal `'` inside a value is replaced with `_` to keep the file
  // parseable. Real-world IDs rarely contain quotes.
  return `'${s.replace(/'/g, "_")}'`;
}

function formatReal(n: number): string {
  if (!Number.isFinite(n)) return "0";
  // Trim trailing zeros but keep at least one decimal point so the
  // reader recognises it as a real not an int (FDS doesn't strictly
  // require this, but it matches author conventions).
  if (Number.isInteger(n)) return `${n}.0`;
  return String(n);
}

function emitIfNumberArray(parts: string[], ps: PropertySet | undefined, name: string): void {
  const p = prop(ps, name);
  if (!p || !Array.isArray(p.value)) return;
  const arr = p.value as unknown[];
  if (arr.length === 0) return;
  const nums = arr.map(v => typeof v === "number" ? v : NaN);
  if (nums.some(Number.isNaN)) return;
  parts.push(`${name}=${nums.join(",")}`);
}

function emitIfString(parts: string[], ps: PropertySet | undefined, name: string): void {
  const v = readString(ps, name);
  if (v !== undefined) parts.push(`${name}=${quote(v)}`);
}

function emitIfReal(parts: string[], ps: PropertySet | undefined, name: string): void {
  const v = readReal(ps, name);
  if (v !== undefined) parts.push(`${name}=${v}`);
}

/**
 * Emit every property in the FDS propset that isn't in `consumed`.
 * Preserves the original namelist parameters that the loader didn't
 * pull into the typed shape.
 */
function emitExtras(parts: string[], ps: PropertySet | undefined, consumed: readonly string[]): void {
  if (!ps) return;
  const skip = new Set(consumed);
  for (const p of ps.properties) {
    if (skip.has(p.name)) continue;
    if (p.name === "_") continue;       // placeholder put in by empty propset
    parts.push(formatExtra(p));
  }
}

function formatExtra(p: Property): string {
  const v = p.value;
  if (typeof v === "string")  return `${p.name}=${quote(v)}`;
  if (typeof v === "boolean") return `${p.name}=${v ? ".TRUE." : ".FALSE."}`;
  if (typeof v === "number")  return `${p.name}=${v}`;
  if (Array.isArray(v))       return `${p.name}=${v.map(serialiseScalar).join(",")}`;
  return `${p.name}=${quote(String(v))}`;
}

function serialiseScalar(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? ".TRUE." : ".FALSE.";
  if (typeof v === "string") return `'${v.replace(/'/g, "_")}'`;
  return `'${String(v).replace(/'/g, "_")}'`;
}

/**
 * Synthetic names like `"Obstruction 3"` are what the loader fills in
 * when the source record had no `ID`. Don't write them back as a
 * pretend `ID=...`.
 */
function isSyntheticName(name: string, kind: string): boolean {
  return new RegExp(`^${kind} \\d+$`).test(name);
}
