import * as WebIFC from "web-ifc";
import {identityMat4 } from "../../../../math/matrix";
import type { DataModel } from "../../../../data";
import type { ModelParseParams } from "../../../ModelParseParams";
import type { SceneModel } from "../../../../scene";
import type { ModelLoadOptions } from "../../../ModelLoadOptions";
import type { LoaderProgress } from "../../../LoaderProgress";
import { TrianglesPrimitive } from "../../../../constants";
import { yieldToHost } from "../../../../utils";

const SCHEMA = "IFC4";

/**
 * Parses an IFC model into scene and data models.
 *
 * Cooperative-yield: every hot loop calls
 * {@link "@xeokit/sdk/utils".yieldToHost | yieldToHost} between
 * items, paced at ≈60 Hz so paint + input are never starved.
 * The same yield points emit `options.onProgress` so a load
 * dialog can show a smooth bar, and check `options.signal` so
 * the load aborts within one yield interval of `signal.abort()`.
 */
export async function parse(ifcAPI: WebIFC.IfcAPI, params: ModelParseParams, options: any): Promise<void> {
  await parseWebIFC(ifcAPI, params, options);
}

interface ParsingContext {
  options: ModelLoadOptions;
  fileData: ArrayBuffer;
  ifcAPI: WebIFC.IfcAPI;
  sceneModel: SceneModel;
  dataModel?: DataModel;
  nextId: number;
  modelId: number;
  lines: WebIFC.Vector<number>;
  ifcProjectId: number;
  propertySetsByObjectExpressId: { [expressId: number]: string[] };
  // Reusable progress payload — loaders are expected to mutate
  // and re-emit this rather than allocating a fresh object per
  // yield (consumers must copy out fields they keep).
  progress: LoaderProgress;
  /**
   * Set of `${relatingId}|${relatedId}|${relType}` keys that
   * have already been processed by
   * {@link parseDataObjectAggregation}. Some IFC files carry
   * multiple `IfcRelAggregates` (or `IfcRelContainedInSpatialStructure`)
   * lines that name the same parent + child pair; without this
   * guard we'd recurse — and `createRelationship` — once per
   * line, leaving every storey / object duplicated in the
   * resulting Data graph.
   */
  visitedRelations: Set<string>;
}

/**
 * Tiny inline helper — emit progress for the current phase
 * without allocating, then yield to the host (which also checks
 * the abort signal). All hot loops route through this so the
 * cadence is consistent across phases.
 */
async function step(ctx: ParsingContext, phase: string, current: number, total: number): Promise<void> {
  const cb = ctx.options.onProgress;
  if (cb) {
    ctx.progress.phase = phase;
    ctx.progress.current = current;
    ctx.progress.total = total;
    cb(ctx.progress);
  }
  await yieldToHost(ctx.options.signal);
}

async function parseWebIFC(ifcAPI: WebIFC.IfcAPI, params: ModelParseParams, options: ModelLoadOptions): Promise<void> {
  const { sceneModel, dataModel, fileData } = params;
  const dataArray = new Uint8Array(fileData);
  // OpenModel runs inside the WASM blob; it's synchronous. Yield
  // before + after so the UI gets one paint either side.
  await yieldToHost(options.signal);
  const modelId = ifcAPI.OpenModel(dataArray);
  await yieldToHost(options.signal);
  const lines = ifcAPI.GetLineIDsWithType(modelId, WebIFC.IFCPROJECT);
  const ifcProjectId = lines.get(0);

  const ctx: ParsingContext = {
    options: options || {},
    fileData,
    modelId,
    lines,
    ifcProjectId,
    ifcAPI,
    sceneModel,
    dataModel,
    nextId: 0,
    propertySetsByObjectExpressId: {},
    progress: { phase: "", current: 0, total: 0 },
    visitedRelations: new Set(),
  };

  await parseIFC(ctx);
}

async function parseIFC(ctx: ParsingContext): Promise<void> {
  if (ctx.dataModel)  await parseDataModel(ctx);
  if (ctx.sceneModel) await parseSceneModel(ctx);
}

async function parseDataModel(ctx: ParsingContext): Promise<void> {
  // Property sets must be created before DataObjects so that createObject can
  // receive propertySetIds and link them at construction time.
  await parsePropertySets(ctx);

  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, WebIFC.IFCPROJECT);
  const ifcProjectId = lines.get(0);
  const ifcProject = ctx.ifcAPI.GetLine(ctx.modelId, ifcProjectId);
  await parseDataObjectAggregation(ctx, ifcProject, undefined, "IfcRelAggregates");
}

async function parsePropertySets(ctx: ParsingContext): Promise<void> {
  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, WebIFC.IFCRELDEFINESBYPROPERTIES);
  const total = lines.size();

  for (let i = 0; i < total; i++) {
    if ((i & 0x3F) === 0) {
      // Step every 64 items — yieldToHost is throttled internally,
      // so the cost of "did enough time pass?" is paid less
      // often, and the abort check still lands within one tick
      // because the throttle gate forces a real yield at most
      // 16 ms apart.
      await step(ctx, "Parsing property sets", i, total);
    }
    const relID = lines.get(i);
    const rel = ctx.ifcAPI.GetLine(ctx.modelId, relID, true);
    if (!rel || !rel.RelatingPropertyDefinition) continue;

    const def = rel.RelatingPropertyDefinition;
    const propertySetId = def.GlobalId?.value;
    if (!propertySetId) continue;

    const properties = (def.HasProperties || []).map((prop) => ({
      name: prop.Name?.value,
      type: prop.NominalValue?.type,
      value: prop.NominalValue?.value,
      valueType: prop.NominalValue?.valueType,
      description: prop.Description?.value || prop.NominalValue?.description || "",
    }));

    ctx.dataModel!.createPropertySet({
      id: propertySetId,
      type: "Default",
      schema: SCHEMA,
      name: def.Name?.value,
      properties,
    });

    // Record which IFC elements (by expressID) reference this property set so
    // we can pass propertySetIds when creating DataObjects.
    for (const relatedObject of (rel.RelatedObjects || [])) {
      const expId: number = relatedObject.value;
      if (!ctx.propertySetsByObjectExpressId[expId]) {
        ctx.propertySetsByObjectExpressId[expId] = [];
      }
      ctx.propertySetsByObjectExpressId[expId].push(propertySetId);
    }
  }
}

async function parseDataObjectAggregation(ctx: ParsingContext, element: any, parentId?: string, relType?: string): Promise<void> {
  createDataObject(ctx, element, parentId, relType);
  const elementId = element.GlobalId.value;

  await parseRelatedItemsOfType(ctx, element.expressID, "RelatingObject", "RelatedObjects", WebIFC.IFCRELAGGREGATES, elementId, "IfcRelAggregates");
  await parseRelatedItemsOfType(ctx, element.expressID, "RelatingStructure", "RelatedElements", WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE, elementId, "IfcRelContainedInSpatialStructure");
}

function createDataObject(ctx: ParsingContext, element: any, parentId?: string, relType?: string): void {

  const id = element.GlobalId.value;
  const typeName = element.__proto__.constructor.name;
  const name = element.Name?.value || typeName;
  const typeCode = typeName ?? "IfcElement";
  const propertySetIds = ctx.propertySetsByObjectExpressId[element.expressID];

  ctx.dataModel!.createObject({
    id,
    name,
    type: typeCode,
    schema: SCHEMA,
    ...(propertySetIds && propertySetIds.length > 0 ? { propertySetIds } : {})
  });

  if (parentId) {
    ctx.dataModel!.createRelationship({
      type: relType || "IfcRelAggregates",
      schema: SCHEMA,
      relatingObjectId: parentId,
      relatedObjectId: id,
    });
  }
}

async function parseRelatedItemsOfType(
  ctx: ParsingContext,
  id: number,
  relationKey: string,
  relatedKey: string,
  type: number,
  parentId: string,
  relTypeName: string
): Promise<void> {
  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, type);
  const total = lines.size();

  for (let i = 0; i < total; i++) {
    if ((i & 0x3F) === 0) {
      await step(ctx, "Parsing data objects", i, total);
    }
    const rel = ctx.ifcAPI.GetLine(ctx.modelId, lines.get(i));
    const relatedItems = rel[relationKey];

    const isMatch = Array.isArray(relatedItems)
      ? relatedItems.some((item) => item.value === id)
      : relatedItems?.value === id;

    if (!isMatch) continue;

    const targets = rel[relatedKey];
    const relatedElements = Array.isArray(targets) ? targets : [targets];

    for (const target of relatedElements) {
      const element = ctx.ifcAPI.GetLine(ctx.modelId, target.value);
      // Skip parent→child→relType triples we've already
      // visited. Some IFC files carry multiple aggregation
      // lines naming the same pair; without this guard the
      // recursion produces duplicate DataObjects + duplicate
      // relationships.
      const childId = element?.GlobalId?.value;
      if (!childId) continue;
      const visitKey = `${parentId}|${childId}|${relTypeName}`;
      if (ctx.visitedRelations.has(visitKey)) continue;
      ctx.visitedRelations.add(visitKey);
      await parseDataObjectAggregation(ctx, element, parentId, relTypeName);
    }
  }
}

async function parseSceneModel(ctx: ParsingContext): Promise<void> {
  // StreamAllMeshes runs entirely synchronously inside the WASM
  // blob — its callback fires once per FlatMesh. The values it
  // yields (FlatMesh + PlacedGeometry + Geometry) all reference
  // WASM-owned memory; that memory is reused / freed by web-ifc
  // as soon as the next call lands, so we copy everything into
  // JS-owned typed arrays inside the callback. The deferred
  // loop below then runs `createGeometry` / `createMesh` from
  // those copies, free of WASM memory aliasing — and free to
  // yield between iterations for cooperative scheduling.
  type StagedGeom = {
    geometryId: string;
    meshId:     string;
    positions:  Float64Array<any>;
    indices:    Uint32Array<any>;
    matrix:     Float64Array<any>;
    color:      [number, number, number];
    opacity:    number;
  };
  type StagedObject = {
    objectId: string;
    geoms:    StagedGeom[];
  };
  const staged: StagedObject[] = [];

  ctx.ifcAPI.StreamAllMeshes(ctx.modelId, (flatMesh) => {
    const objectId = ctx.ifcAPI.GetLine(ctx.modelId, flatMesh.expressID).GlobalId.value;
    const geoms: StagedGeom[] = [];

    for (let j = 0; j < flatMesh.geometries.size(); j++) {
      const placedGeometry = flatMesh.geometries.get(j);
      const geometry = ctx.ifcAPI.GetGeometry(ctx.modelId, placedGeometry.geometryExpressID);
      const vertexData = ctx.ifcAPI.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
      const indicesView = ctx.ifcAPI.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
      if (vertexData.length === 0 || indicesView.length === 0) {
        continue;
      }

      // Decompose the interleaved (pos.xyz, normal.xyz) vertex stream
      // into a JS-owned positions buffer. Normals are dropped here —
      // SceneModel.createGeometry would re-encode them anyway, and
      // the renderer reconstructs flat normals per fragment when
      // missing.
      const positions = new Float64Array(vertexData.length / 2);
      for (let k = 0, l = 0; k < vertexData.length / 6; k++, l += 3) {
        positions[l]     = vertexData[k * 6];
        positions[l + 1] = vertexData[k * 6 + 1];
        positions[l + 2] = vertexData[k * 6 + 2];
      }

      // `indicesView` is a typed-array view into WASM memory. Copy
      // into a fresh JS-owned Uint32Array so the deferred loop
      // doesn't dereference freed WASM heap.
      const indices = new Uint32Array(indicesView.length);
      indices.set(indicesView);

      // Same pattern for the placement transform — `flatTransformation`
      // is a 16-element view into WASM memory.
      const matrix = identityMat4() as Float64Array<any>;
      matrix.set(placedGeometry.flatTransformation);

      // Color components are scalar fields on the PlacedGeometry,
      // so a value-copy is enough.
      const color: [number, number, number] = [
        placedGeometry.color.x,
        placedGeometry.color.y,
        placedGeometry.color.z,
      ];
      const opacity = placedGeometry.color.w;

      geoms.push({
        geometryId: `${ctx.nextId++}`,
        meshId:     `${ctx.nextId++}`,
        positions,
        indices,
        matrix,
        color,
        opacity,
      });
    }

    if (geoms.length > 0) {
      staged.push({objectId, geoms});
    }
  });

  // ── Drain phase: now that every FlatMesh's data is in JS-owned
  // memory, push it into the SceneModel with cooperative yields.

  const total = staged.length;
  for (let i = 0; i < total; i++) {
    if ((i & 0x07) === 0) {
      // Step every 8 objects — geometry is heavy, so the throttle
      // in yieldToHost won't always swallow these. 1/8 cadence
      // keeps the progress callback emitting at a sensible rate
      // even on small models.
      await step(ctx, "Building meshes", i, total);
    }

    const {objectId, geoms} = staged[i];
    const meshIds: string[] = [];

    for (const g of geoms) {
      const geometryResult = ctx.sceneModel.createGeometry({
        id:        g.geometryId,
        primitive: TrianglesPrimitive,
        positions: g.positions,
        indices:   g.indices,
      });
      if (!geometryResult.ok) {
        continue;
      }

      const meshResult = ctx.sceneModel.createMesh({
        id:         g.meshId,
        geometryId: g.geometryId,
        matrix:     g.matrix,
        color:      g.color,
        opacity:    g.opacity,
      });
      if (!meshResult.ok) {
        continue;
      }

      meshIds.push(g.meshId);
    }

    if (meshIds.length > 0) {
      ctx.sceneModel.createObject({
        id:      objectId,
        meshIds,
        layerId: ctx.options.layerId,
      });
    }
  }

  // Final progress emit so the consumer sees 100% before the
  // promise resolves.
  await step(ctx, "Building meshes", total, total);
}
