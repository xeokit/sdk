import type {DataModel} from "../../../../model/data/DataModel";
import type {PropertyParams} from "../../../../model/data/PropertyParams";
import type {FDSModel, FDSMesh} from "./types";
import {FDS_SCHEMA_ID} from "./schema";

/**
 * Builds {@link DataObject}s, {@link Relationship}s, and
 * {@link PropertySet}s for the parsed {@link FDSModel}.
 *
 * IDs follow the same convention as the matching
 * {@link buildGeometry} call so each SceneObject has its DataObject
 * sibling:
 *
 *  - project  : `"FDS::project"`
 *  - mesh     : `"FDS::mesh:<n>"`
 *  - surface  : `"FDS::surf:<surfId>"`
 *  - obst     : `"FDS::obst:<n>"` (each remainder box uses the parent
 *               obst's id; SceneModel sub-meshes are grouped under
 *               this single SceneObject id)
 *  - vent     : `"FDS::vent:<n>"`
 *  - hole     : `"FDS::hole:<n>"`
 *
 * @internal
 */
export function buildDataModel(model: FDSModel, dataModel: DataModel, modelId: string): void {

  // ── Project (one per file) ───────────────────────────────────
  const projectId = idProject();
  dataModel.createObject({
    id:     projectId,
    type:   "FDSProject",
    schema: FDS_SCHEMA_ID,
    name:   model.head?.title ?? model.head?.chid ?? modelId,
  });

  // ── Surfaces ─────────────────────────────────────────────────
  for (const surf of model.surfs.values()) {
    const sid = idSurf(surf.id);
    const props: PropertyParams[] = [];
    if (surf.rgb)                       props.push({name: "RGB",          value: [...surf.rgb], valueType: "array"});
    if (surf.color !== undefined)       props.push({name: "COLOR",        value: surf.color,    valueType: "string"});
    if (surf.transparency !== undefined) props.push({name: "TRANSPARENCY", value: surf.transparency, valueType: "real"});
    for (const p of extrasProps(surf.extras)) props.push(p);
    dataModel.createObject({
      id:     sid,
      type:   "FDSSurface",
      schema: FDS_SCHEMA_ID,
      name:   surf.id,
      propertySetIds: [createPropSet(dataModel, sid + ":fds", "FDS", "FDS", props)],
    });
  }

  // ── Meshes ───────────────────────────────────────────────────
  for (let i = 0; i < model.meshes.length; i++) {
    const mesh = model.meshes[i];
    const mid = idMesh(i);
    const pset = createPropSet(dataModel, mid + ":geom", "Geometry", "Geometry",
      xbProps(mesh.xb).concat(meshIjkProps(mesh)));
    dataModel.createObject({
      id:     mid,
      type:   "FDSMesh",
      schema: FDS_SCHEMA_ID,
      name:   mesh.id ?? `Mesh ${i + 1}`,
      propertySetIds: [pset],
    });
    dataModel.createRelationship({
      type:             "contains",
      schema:           FDS_SCHEMA_ID,
      relatingObjectId: projectId,
      relatedObjectId:  mid,
    });
  }

  // ── Obstructions ─────────────────────────────────────────────
  for (let i = 0; i < model.obsts.length; i++) {
    const o = model.obsts[i];
    const oid = idObst(i);
    const psetIds = [
      createPropSet(dataModel, oid + ":geom", "Geometry", "Geometry", xbProps(o.xb)),
    ];
    const fdsProps: PropertyParams[] = [];
    if (o.rgb)                  fdsProps.push({name: "RGB",   value: [...o.rgb], valueType: "array"});
    if (o.color !== undefined)  fdsProps.push({name: "COLOR", value: o.color,    valueType: "string"});
    for (const p of extrasProps(o.extras)) fdsProps.push(p);
    if (fdsProps.length > 0) {
      psetIds.push(createPropSet(dataModel, oid + ":fds", "FDS", "FDS", fdsProps));
    }
    dataModel.createObject({
      id:     oid,
      type:   "FDSObstruction",
      schema: FDS_SCHEMA_ID,
      name:   o.id ?? `Obstruction ${i + 1}`,
      propertySetIds: psetIds,
    });
    relateToOwningMesh(dataModel, model, o.xb, oid);
    if (o.surfId && model.surfs.has(o.surfId)) {
      dataModel.createRelationship({
        type:             "usesSurface",
        schema:           FDS_SCHEMA_ID,
        relatingObjectId: oid,
        relatedObjectId:  idSurf(o.surfId),
      });
    }
  }

  // ── Vents ────────────────────────────────────────────────────
  for (let i = 0; i < model.vents.length; i++) {
    const v = model.vents[i];
    const vid = idVent(i);
    const geomProps: PropertyParams[] = v.xb ? xbProps(v.xb) : [];
    if (v.mb) geomProps.push({name: "MB", value: v.mb, valueType: "string"});
    if (v.ior !== undefined) geomProps.push({name: "IOR", value: v.ior, valueType: "integer"});
    const psetIds = [
      createPropSet(dataModel, vid + ":geom", "Geometry", "Geometry", geomProps),
    ];
    const fdsProps: PropertyParams[] = [];
    if (v.rgb)                  fdsProps.push({name: "RGB",   value: [...v.rgb], valueType: "array"});
    if (v.color !== undefined)  fdsProps.push({name: "COLOR", value: v.color,    valueType: "string"});
    for (const p of extrasProps(v.extras)) fdsProps.push(p);
    if (fdsProps.length > 0) {
      psetIds.push(createPropSet(dataModel, vid + ":fds", "FDS", "FDS", fdsProps));
    }
    dataModel.createObject({
      id:     vid,
      type:   "FDSVent",
      schema: FDS_SCHEMA_ID,
      name:   v.id ?? `Vent ${i + 1}`,
      propertySetIds: psetIds,
    });
    if (v.xb) relateToOwningMesh(dataModel, model, v.xb, vid);
    if (v.surfId && model.surfs.has(v.surfId)) {
      dataModel.createRelationship({
        type:             "usesSurface",
        schema:           FDS_SCHEMA_ID,
        relatingObjectId: vid,
        relatedObjectId:  idSurf(v.surfId),
      });
    }
  }

  // ── Holes ────────────────────────────────────────────────────
  // Holes are bookkeeping in v1 — they participate in the data graph
  // (so reviewers can find them) but emit no geometry of their own.
  for (let i = 0; i < model.holes.length; i++) {
    const h = model.holes[i];
    const hid = idHole(i);
    const psetIds = [
      createPropSet(dataModel, hid + ":geom", "Geometry", "Geometry", xbProps(h.xb)),
    ];
    if (h.extras.size > 0) {
      psetIds.push(createPropSet(dataModel, hid + ":fds", "FDS", "FDS", extrasProps(h.extras)));
    }
    dataModel.createObject({
      id:     hid,
      type:   "FDSHole",
      schema: FDS_SCHEMA_ID,
      name:   h.id ?? `Hole ${i + 1}`,
      propertySetIds: psetIds,
    });
    relateToOwningMesh(dataModel, model, h.xb, hid);
  }
}

// ─────────── helpers ───────────

function createPropSet(
  dataModel: DataModel,
  id: string,
  name: string,
  type: string,
  properties: PropertyParams[],
): string {
  if (properties.length === 0) {
    properties = [{name: "_", value: "", valueType: "string"}];
  }
  dataModel.createPropertySet({id, name, type, schema: FDS_SCHEMA_ID, properties});
  return id;
}

function xbProps(xb: readonly number[]): PropertyParams[] {
  return [
    {name: "XMIN", value: xb[0], valueType: "real"},
    {name: "XMAX", value: xb[1], valueType: "real"},
    {name: "YMIN", value: xb[2], valueType: "real"},
    {name: "YMAX", value: xb[3], valueType: "real"},
    {name: "ZMIN", value: xb[4], valueType: "real"},
    {name: "ZMAX", value: xb[5], valueType: "real"},
  ];
}

function meshIjkProps(mesh: FDSMesh): PropertyParams[] {
  if (!mesh.ijk) return [];
  return [
    {name: "I", value: mesh.ijk[0], valueType: "integer"},
    {name: "J", value: mesh.ijk[1], valueType: "integer"},
    {name: "K", value: mesh.ijk[2], valueType: "integer"},
  ];
}

function extrasProps(extras: ReadonlyMap<string, unknown>): PropertyParams[] {
  const out: PropertyParams[] = [];
  for (const [k, v] of extras) {
    out.push({name: k, value: v, valueType: typeofProp(v)});
  }
  return out;
}

function typeofProp(v: unknown): string {
  if (typeof v === "number") return "real";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "string") return "string";
  if (Array.isArray(v)) return "array";
  return "string";
}

/**
 * If the element's centre falls inside a mesh's XB, attach it to that
 * mesh; otherwise hang it off the Project. FDS doesn't carry an
 * explicit mesh-membership relation, so we infer it spatially —
 * matches how Smokeview groups elements.
 */
function relateToOwningMesh(dataModel: DataModel, model: FDSModel, xb: readonly number[], elementId: string): void {
  const cx = (xb[0] + xb[1]) * 0.5;
  const cy = (xb[2] + xb[3]) * 0.5;
  const cz = (xb[4] + xb[5]) * 0.5;
  let owner = idProject();
  for (let i = 0; i < model.meshes.length; i++) {
    const m = model.meshes[i].xb;
    if (cx >= Math.min(m[0], m[1]) && cx <= Math.max(m[0], m[1]) &&
        cy >= Math.min(m[2], m[3]) && cy <= Math.max(m[2], m[3]) &&
        cz >= Math.min(m[4], m[5]) && cz <= Math.max(m[4], m[5])) {
      owner = idMesh(i);
      break;
    }
  }
  dataModel.createRelationship({
    type:             "contains",
    schema:           FDS_SCHEMA_ID,
    relatingObjectId: owner,
    relatedObjectId:  elementId,
  });
}

// ID generators — kept consistent with buildGeometry so SceneObject ↔
// DataObject IDs match.
export function idProject(): string  { return "FDS::project"; }
export function idMesh(i: number)    { return `FDS::mesh:${i}`; }
export function idSurf(name: string) { return `FDS::surf:${name}`; }
export function idObst(i: number)    { return `FDS::obst:${i}`; }
export function idVent(i: number)    { return `FDS::vent:${i}`; }
export function idHole(i: number)    { return `FDS::hole:${i}`; }

