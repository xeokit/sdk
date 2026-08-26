/**
 * Default {@link SpaceExtractor} for IFC building models.
 *
 * Pipeline:
 *  1. Walk `dataModel.objectsByType["IfcSpace"]` — every
 *     `IfcSpace` becomes one {@link SpaceGraphNode}, with AABB /
 *     centroid / floor elevation pulled from the matching
 *     SceneObject via the scene collision index.
 *  2. Walk `dataModel.objectsByType["IfcDoor"]` — for each door,
 *     resolve the spaces it connects via
 *     `IfcRelSpaceBoundary` (preferred — the canonical relation
 *     authored by most BIM tools). If no `IfcRelSpaceBoundary`
 *     is present, fall back to spatial proximity: find the two
 *     closest spaces whose AABBs are adjacent to the door's AABB.
 *  3. Build {@link SpaceGraphEdge}s for door pairs found, then
 *     populate per-node back-references.
 *
 * Returns an empty-but-valid {@link SpaceGraph} when the
 * DataModel contains no `IfcSpace` entries; returns
 * `InvalidInput` only when `dataModel` is missing entirely.
 */
import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";
import type {AABB3, AABB3Float} from "@xeokit/sdk/base/math/boundaries";
import type {Vec3} from "@xeokit/sdk/base/math/vector";
import type {DataObject} from "@xeokit/sdk/model/data";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";

import type {SpaceExtractor, SpaceExtractorInput} from "./SpaceExtractor";
import type {SpaceGraph} from "../graph/SpaceGraph";
import type {SpaceGraphEdge} from "../graph/SpaceGraphEdge";
import type {SpaceGraphNode} from "../graph/SpaceGraphNode";
import {aabbCentroid, resolveUpAxis} from "../internal/cameraTourMath";


const IFC_SPACE = "IfcSpace";
const IFC_DOOR  = "IfcDoor";
const IFC_REL_SPACE_BOUNDARY  = "IfcRelSpaceBoundary";
const IFC_REL_CONTAINED       = "IfcRelContainedInSpatialStructure";
const IFC_REL_AGGREGATES      = "IfcRelAggregates";


export const extractSpacesFromIfc: SpaceExtractor = {

  extract: async (input: SpaceExtractorInput): Promise<SDKResult<SpaceGraph>> => {

    const {sceneModel, dataModel, options} = input;

    if (!dataModel) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[extractSpacesFromIfc] DataModel is required " +
               "(IFC extractor walks IfcSpace + IfcRelSpaceBoundary). " +
               "Pass `extractSpacesFromGeometry` as `params.extractor` " +
               "for sources without semantic data.",
      };
    }
    if (sceneModel.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[extractSpacesFromIfc] sceneModel is destroyed",
      };
    }

    options.onProgress?.("extract", 0);

    const collisionIndex = getSceneCollisionIndex(sceneModel.scene);
    const upAxis = resolveUpAxis(options.up ?? sceneModel.scene.coordinateSystem.worldUp);

    // ── 1. IfcSpace → SpaceGraphNode ──────────────────────────────
    const spaceObjects = dataModel.objectsByType[IFC_SPACE] ?? {};
    const nodes: SpaceGraphNode[] = [];
    const nodesById = new Map<string, SpaceGraphNode>();
    const edgesByNodeId = new Map<string, SpaceGraphEdge[]>();

    for (const spaceId of Object.keys(spaceObjects)) {
      const spaceData = spaceObjects[spaceId];
      // Try direct AABB first. When the loader didn't render
      // IfcSpace geometry (web-ifc filters it out by default —
      // spaces are invisible volumes), fall back to synthesising
      // the AABB from elements the IFC file says the space
      // contains. Only skip when both paths fail.
      let aabb = collisionIndex.getObjectAABB(spaceId);
      if (!aabb) {
        aabb = synthesizeSpaceAabb(spaceData, collisionIndex);
      }
      if (!aabb) continue;
      const node: SpaceGraphNode = {
        id: spaceId,
        aabb: aabbToFloat64(aabb),
        centroid: aabbCentroid(aabb),
        floorElevation: aabb[upAxis],   // upAxis indexes the min-corner triple
        sceneObjectId: sceneModel.objects[spaceId] ? spaceId : undefined,
        dataObjectId: spaceId,
        label: resolveLabel(spaceData),
        edges: [],   // populated after edges are built
      };
      nodes.push(node);
      nodesById.set(spaceId, node);
      edgesByNodeId.set(spaceId, []);
    }

    options.onProgress?.("extract", 0.5);

    // ── 2. IfcDoor → SpaceGraphEdge ───────────────────────────────
    const doorObjects = dataModel.objectsByType[IFC_DOOR] ?? {};
    const edges: SpaceGraphEdge[] = [];
    let edgeCounter = 0;

    for (const doorId of Object.keys(doorObjects)) {
      const doorData = doorObjects[doorId];

      let [aId, bId] = resolveDoorSpacesViaRelSpaceBoundary(doorData, nodesById);

      if (!aId || !bId) {
        // Fallback: spatial proximity. Doors authored without
        // IfcRelSpaceBoundary (common in non-architect exports)
        // still work as long as their AABB lies between two
        // recognised spaces.
        const doorAabb = collisionIndex.getObjectAABB(doorId);
        if (doorAabb) {
          [aId, bId] = resolveDoorSpacesByProximity(doorAabb, nodes);
        }
      }
      if (!aId || !bId || aId === bId) continue;

      const doorAabb = collisionIndex.getObjectAABB(doorId);
      const position = doorAabb ? aabbCentroid(doorAabb) : aabbCentroid(nodesById.get(aId)!.aabb);
      const normal   = normaliseVec3(subVec3(
        nodesById.get(bId)!.centroid, nodesById.get(aId)!.centroid,
      ));
      const {width, height} = doorAabb
        ? doorExtents(doorAabb, normal, upAxis)
        : {width: undefined, height: undefined};

      const edge: SpaceGraphEdge = {
        id:            `door-${edgeCounter++}-${doorId}`,
        from:          aId,
        to:            bId,
        position,
        normal,
        width,
        height,
        sceneObjectId: sceneModel.objects[doorId] ? doorId : undefined,
        dataObjectId:  doorId,
      };
      edges.push(edge);
      edgesByNodeId.get(aId)!.push(edge);
      edgesByNodeId.get(bId)!.push(edge);
    }

    // ── 3. Back-references ────────────────────────────────────────
    // Nodes were built with placeholder `edges: []` before any edges
    // existed; now that edges are computed, swap in each node's
    // actual incident-edge list. Cast through `unknown` because the
    // interface declares `edges` ReadonlyArray (the public contract);
    // the swap is a build-time-only mutation.
    for (const node of nodes) {
      (node as unknown as { edges: SpaceGraphEdge[] }).edges =
          edgesByNodeId.get(node.id) ?? [];
    }

    options.onProgress?.("extract", 1);

    const graph: SpaceGraph = {
      nodes,
      edges,
      nodesById,
    };
    return {ok: true, value: graph};
  },
};


// ─── Helpers ─────────────────────────────────────────────────────

function aabbToFloat64(aabb: ArrayLike<number>): AABB3 {
  const out = new Float64Array(6);
  for (let i = 0; i < 6; i++) out[i] = aabb[i];
  return out as unknown as AABB3;
}

function subVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as Vec3;
}

function normaliseVec3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len] as Vec3;
}

function resolveLabel(spaceData: DataObject): string | undefined {
  // IfcSpace.LongName is the room name end-users care about
  // ("Conference Room 401"); .Name is often a code ("CR-401").
  // PropertySets aren't walked here — keep the label terse.
  return spaceData.name && spaceData.name.length > 0 ? spaceData.name : undefined;
}

/**
 * Synthesise an IfcSpace's AABB from its IFC relationships when
 * the loader didn't render the space's own geometry. Web-ifc's
 * `StreamAllMeshes` skips IfcSpace by default (invisible volumes
 * would render as transparent boxes covering the visible model),
 * so the space's `getObjectAABB` returns `null` — but the IFC
 * file still tells us what the space contains / aggregates /
 * bounds, and those elements DID get rendered.
 *
 * Tried in order of preference:
 *  1. **Contained elements** —
 *     `IfcSpace —IfcRelContainedInSpatialStructure→ furniture,
 *     fixtures`. The most common signal for inhabited rooms:
 *     kitchens have appliances, bathrooms have plumbing, offices
 *     have desks.
 *  2. **Aggregated parts** —
 *     `IfcSpace —IfcRelAggregates→ parts`. Rare but possible
 *     (some BIM tools decompose spaces into sub-spaces or
 *     equipment groups).
 *  3. **Bounding elements** —
 *     `IfcSpace —IfcRelSpaceBoundary→ walls, doors`. The
 *     canonical "what physically encloses this space" signal;
 *     gives the most accurate bound when authored, but many IFC
 *     files (Duplex included) ship without space boundaries.
 *
 * Returns `null` only when all three signals are absent — the
 * caller skips that space and lets the empty-graph fallback in
 * `planCameraTour` kick in.
 */
function synthesizeSpaceAabb(
    spaceData: DataObject,
    collisionIndex: ReturnType<typeof getSceneCollisionIndex>,
): AABB3Float | null {
  // The DataObject.related map is declared with numeric keys but
  // the runtime keys are the relationship type strings — cast
  // through `unknown` to satisfy the TS contract while preserving
  // the actual runtime behaviour.
  const related = spaceData.related as unknown as {[type: string]: Array<{relatedObject: {id: string}}>} | undefined;
  if (!related) return null;

  for (const relType of [IFC_REL_CONTAINED, IFC_REL_AGGREGATES, IFC_REL_SPACE_BOUNDARY]) {
    const rels = related[relType];
    if (!rels || rels.length === 0) continue;
    const ids: string[] = [];
    for (const rel of rels) ids.push(rel.relatedObject.id);
    const combined = collisionIndex.getCombinedObjectAABB(ids);
    if (combined) return combined;
  }
  return null;
}

/**
 * Walk a door's `IfcRelSpaceBoundary` relationships looking for
 * the two `IfcSpace`s it bounds. Returns the pair (or `[null, null]`
 * if fewer than two spaces are found). Doors that touch three+
 * spaces (corner doors, vestibules) return the first two — the
 * planner treats each door as a single portal.
 */
function resolveDoorSpacesViaRelSpaceBoundary(
    doorData: DataObject,
    nodesById: Map<string, SpaceGraphNode>,
): [string | null, string | null] {
  const rels = doorData.relating?.[IFC_REL_SPACE_BOUNDARY as unknown as number];
  if (!rels || rels.length === 0) return [null, null];
  let aId: string | null = null;
  let bId: string | null = null;
  for (const rel of rels) {
    const spaceId = rel.relatingObject.id;
    if (!nodesById.has(spaceId)) continue;
    if (!aId)              { aId = spaceId; continue; }
    if (aId !== spaceId)   { bId = spaceId; break; }
  }
  return [aId, bId];
}

/**
 * Fallback: pick the two nearest spaces (by AABB centroid distance
 * to the door's AABB centroid) whose AABBs overlap the door's
 * inflated AABB. Returns `[null, null]` if fewer than two qualify.
 *
 * Inflation is a small constant in scene units — enough to bridge
 * the door-thickness gap between adjacent rooms without false-
 * positiving across thin walls. Real-world door thickness is
 * ~40-50mm; we use 200mm to be generous.
 */
function resolveDoorSpacesByProximity(
    doorAabb: ArrayLike<number>,
    nodes: ReadonlyArray<SpaceGraphNode>,
): [string | null, string | null] {
  const INFLATE = 0.2;
  const inflated = [
    doorAabb[0] - INFLATE, doorAabb[1] - INFLATE, doorAabb[2] - INFLATE,
    doorAabb[3] + INFLATE, doorAabb[4] + INFLATE, doorAabb[5] + INFLATE,
  ];
  const door = aabbCentroid(doorAabb);
  const candidates: Array<{id: string; d2: number}> = [];
  for (const node of nodes) {
    if (!aabbsOverlap(inflated, node.aabb as unknown as ArrayLike<number>)) continue;
    const c = node.centroid;
    const dx = c[0] - door[0], dy = c[1] - door[1], dz = c[2] - door[2];
    candidates.push({id: node.id, d2: dx * dx + dy * dy + dz * dz});
  }
  if (candidates.length < 2) return [null, null];
  candidates.sort((a, b) => a.d2 - b.d2);
  return [candidates[0].id, candidates[1].id];
}

function aabbsOverlap(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  return a[0] <= b[3] && a[3] >= b[0] &&
         a[1] <= b[4] && a[4] >= b[1] &&
         a[2] <= b[5] && a[5] >= b[2];
}

/**
 * Resolve a door's clear opening width / height from its AABB
 * given the through-direction (portal normal) and up axis. The
 * through-direction is the AABB's thinnest in-plane axis; the
 * other in-plane axis is the door width; the up-axis extent is
 * the height.
 */
function doorExtents(
    doorAabb: ArrayLike<number>,
    normal: Vec3,
    upAxis: 1 | 2,
): {width: number; height: number} {
  const extents: [number, number, number] = [
    doorAabb[3] - doorAabb[0],
    doorAabb[4] - doorAabb[1],
    doorAabb[5] - doorAabb[2],
  ];
  const height = extents[upAxis];
  // Width axis: the in-plane axis (not up, not through-direction).
  // Pick by elimination — whichever horizontal axis is most
  // perpendicular to the portal normal.
  const horizontalAxes: Array<0 | 1 | 2> = upAxis === 1 ? [0, 2] : [0, 1];
  const aPerp = Math.abs(normal[horizontalAxes[0]]);
  const bPerp = Math.abs(normal[horizontalAxes[1]]);
  const widthAxis = aPerp < bPerp ? horizontalAxes[0] : horizontalAxes[1];
  return {width: extents[widthAxis], height};
}
