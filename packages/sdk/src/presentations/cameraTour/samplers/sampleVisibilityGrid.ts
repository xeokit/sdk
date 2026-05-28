/**
 * Default {@link ViewpointSampler}. Lays out a horizontal grid of
 * candidate camera positions inside each space, scores each by
 * raycast visibility coverage, and returns the top
 * {@link CameraTourPlanOptions.maxViewpointsPerRoom} per space.
 *
 * Pipeline per space:
 *  1. **Grid** — over-sample the room footprint at
 *     `ceil(sqrt(maxViewpointsPerRoom * 4))` × same in the two
 *     horizontal axes. Eye height is
 *     {@link SpaceGraphNode.floorElevation} + `eyeHeight`.
 *  2. **Clearance prune** — for every candidate, raycast in 8
 *     horizontal directions; drop the candidate if any hit is
 *     closer than `wallClearance`.
 *  3. **Score visibility** — cast `visibilityRayCount` rays in a
 *     horizontal arc with a slight downward bias (so floor reads).
 *     Score = mean(min(hitDist, roomDiameter)) / roomDiameter,
 *     bounded `[0, 1]`. Higher = more open / more revealing
 *     viewpoint.
 *  4. **Look direction** — toward the nearest portal centroid
 *     when the space has edges; otherwise toward the
 *     longest-clear ray direction recorded during scoring.
 *  5. **Top-K** — sort candidates by score descending, take up
 *     to `maxViewpointsPerRoom`.
 *
 * Ray queries use {@link SceneCollisionIndex.intersectRay} — AABB-
 * granularity, not triangle-precise. The space's own SceneObject
 * is filtered out of every hit list since most space meshes are
 * thin shell volumes that would otherwise occlude every ray.
 */
import {type SDKResult} from "../../../base/core";
import type {Vec3} from "../../../base/math/vector";
import {getSceneCollisionIndex, type SceneCollisionRayHit} from "../../../spatial/collision";

import type {SpaceGraphNode} from "../graph/SpaceGraphNode";
import type {ViewpointGraph} from "../graph/ViewpointGraph";
import type {ViewpointGraphNode} from "../graph/ViewpointGraphNode";
import type {ViewpointSampler, ViewpointSamplerInput} from "./ViewpointSampler";
import {resolveUpAxis, squaredDist} from "../internal/cameraTourMath";


/** Clearance probe directions in the horizontal plane (8 cardinals + diagonals). */
const CLEARANCE_DIRS_UNIT = 8;


export const sampleVisibilityGrid: ViewpointSampler = {

  sample: async (input: ViewpointSamplerInput): Promise<SDKResult<ViewpointGraph>> => {

    const {spaceGraph, sceneModel, options} = input;
    const collisionIndex = getSceneCollisionIndex(sceneModel.scene);
    const upAxis = resolveUpAxis(options.up ?? sceneModel.scene.coordinateSystem.worldUp);
    const horizAxes: [0 | 1 | 2, 0 | 1 | 2] = upAxis === 1 ? [0, 2] : [0, 1];

    const nodes: ViewpointGraphNode[] = [];
    const nodesBySpaceId = new Map<string, ReadonlyArray<ViewpointGraphNode>>();
    let viewpointCounter = 0;
    let spaceIdx = 0;
    const spaceCount = Math.max(1, spaceGraph.nodes.length);

    for (const space of spaceGraph.nodes) {
      const bucket = await sampleOneSpace({
        space,
        sceneModel,
        collisionIndex,
        upAxis,
        horizAxes,
        options,
        idPrefix: () => `vp-${viewpointCounter++}`,
      });
      nodes.push(...bucket);
      nodesBySpaceId.set(space.id, bucket);

      // Yield between spaces so a big building doesn't block the
      // main thread for hundreds of ms during scoring.
      spaceIdx++;
      options.onProgress?.("sample", spaceIdx / spaceCount);
      if (spaceIdx % 4 === 0) await yieldToHost();
    }

    return {ok: true, value: {nodes, nodesBySpaceId}};
  },
};


// ─── Per-space scoring ──────────────────────────────────────────

interface PerSpaceInput {
  space: SpaceGraphNode;
  sceneModel: ViewpointSamplerInput["sceneModel"];
  collisionIndex: ReturnType<typeof getSceneCollisionIndex>;
  upAxis: 1 | 2;
  horizAxes: [0 | 1 | 2, 0 | 1 | 2];
  options: ViewpointSamplerInput["options"];
  idPrefix: () => string;
}


async function sampleOneSpace(input: PerSpaceInput): Promise<ViewpointGraphNode[]> {

  const {space, collisionIndex, upAxis, horizAxes, options, idPrefix} = input;

  const aabb = space.aabb as unknown as ArrayLike<number>;
  const widthAxis  = horizAxes[0];
  const depthAxis  = horizAxes[1];
  const roomWidth  = aabb[widthAxis + 3] - aabb[widthAxis];
  const roomDepth  = aabb[depthAxis + 3] - aabb[depthAxis];
  const roomDiag   = Math.hypot(roomWidth, roomDepth) || 1;

  // Grid size — over-sample to give the top-K selector real choice.
  const N = Math.max(3, Math.ceil(Math.sqrt(options.maxViewpointsPerRoom * 4)));
  // Inset half a cell so candidates don't sit on the AABB faces.
  const stepW = roomWidth / N;
  const stepD = roomDepth / N;

  type Candidate = {
    position: Vec3;
    score:    number;
    bestDir:  Vec3;     // direction with the longest clear ray — used as
                         // a look-direction fallback when no portal exists
    visibilityCoverage: number;
  };
  const candidates: Candidate[] = [];

  const eyeY = space.floorElevation + options.eyeHeight;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const position: Vec3 = [0, 0, 0] as Vec3;
      position[widthAxis] = aabb[widthAxis] + stepW * (i + 0.5);
      position[depthAxis] = aabb[depthAxis] + stepD * (j + 0.5);
      position[upAxis]    = eyeY;

      if (!hasClearance(position, options.wallClearance, collisionIndex, upAxis, space.sceneObjectId)) {
        continue;
      }
      const {score, bestDir, coverage} = scoreVisibility(
          position, options.visibilityRayCount, collisionIndex,
          upAxis, horizAxes, roomDiag, space.sceneObjectId);
      candidates.push({position, score, bestDir, visibilityCoverage: coverage});
    }
  }

  if (candidates.length === 0) return [];

  // Pick top-K and emit ViewpointGraphNodes.
  candidates.sort((a, b) => b.score - a.score);
  const keep = candidates.slice(0, options.maxViewpointsPerRoom);

  const up = (options.up ?? input.sceneModel.scene.coordinateSystem.worldUp) as Vec3;
  return keep.map((c) => {
    const look = pickLookDirection(space, c.position, c.bestDir);
    return {
      id:                 idPrefix(),
      spaceId:            space.id,
      position:           c.position,
      look,
      up,
      score:              c.score,
      visibilityCoverage: c.visibilityCoverage,
    };
  });
}


// ─── Clearance test ─────────────────────────────────────────────

function hasClearance(
    position: Vec3,
    clearance: number,
    collisionIndex: ReturnType<typeof getSceneCollisionIndex>,
    upAxis: 1 | 2,
    spaceObjectId: string | undefined,
): boolean {
  for (let k = 0; k < CLEARANCE_DIRS_UNIT; k++) {
    const theta = (k / CLEARANCE_DIRS_UNIT) * Math.PI * 2;
    const dir: Vec3 = [0, 0, 0] as Vec3;
    setHorizontalDir(dir, theta, upAxis);
    const hits = collisionIndex.intersectRay(position, dir, {tMin: 0, tMax: clearance});
    for (const hit of hits) {
      if (hit.objectId === spaceObjectId) continue;
      if (hit.tEnter < clearance) return false;
    }
  }
  return true;
}


// ─── Visibility scoring ─────────────────────────────────────────

interface VisibilityScore {
  score: number;          // [0, 1]
  bestDir: Vec3;          // longest-clear ray direction
  coverage: number;       // fraction of rays that reached roomDiag (or further)
}

function scoreVisibility(
    position: Vec3,
    rayCount: number,
    collisionIndex: ReturnType<typeof getSceneCollisionIndex>,
    upAxis: 1 | 2,
    horizAxes: [0 | 1 | 2, 0 | 1 | 2],
    roomDiag: number,
    spaceObjectId: string | undefined,
): VisibilityScore {
  if (rayCount <= 0) {
    return {score: 0.5, bestDir: makeHorizontalDir(0, upAxis), coverage: 0};
  }
  // Slight downward pitch (~5°) — humans walking through a space
  // tilt eyes down a bit, and the rays then sample the floor edge
  // rather than skimming the ceiling.
  const pitch = -5 * Math.PI / 180;
  let sum = 0;
  let reached = 0;
  let bestT = -1;
  const bestDir: Vec3 = [0, 0, 0] as Vec3;
  setHorizontalDir(bestDir, 0, upAxis);

  for (let k = 0; k < rayCount; k++) {
    const theta = (k / rayCount) * Math.PI * 2;
    const dir = makePitchedDir(theta, pitch, upAxis, horizAxes);
    const t = nearestHitDistance(position, dir, collisionIndex, spaceObjectId);
    const bounded = Math.min(t, roomDiag);
    sum += bounded;
    if (t >= roomDiag) reached++;
    if (t > bestT) {
      bestT = t;
      bestDir[0] = dir[0]; bestDir[1] = dir[1]; bestDir[2] = dir[2];
    }
  }
  const meanBounded = sum / rayCount;
  return {
    score:    meanBounded / roomDiag,
    bestDir,
    coverage: reached / rayCount,
  };
}

function nearestHitDistance(
    origin: Vec3,
    dir: Vec3,
    collisionIndex: ReturnType<typeof getSceneCollisionIndex>,
    spaceObjectId: string | undefined,
): number {
  const hits: SceneCollisionRayHit[] = collisionIndex.intersectRay(origin, dir);
  for (const hit of hits) {
    if (hit.objectId === spaceObjectId) continue;
    return hit.tEnter;
  }
  return Infinity;
}


// ─── Look-direction selection ───────────────────────────────────

function pickLookDirection(
    space: SpaceGraphNode,
    eye: Vec3,
    bestDirFallback: Vec3,
): Vec3 {
  if (space.edges.length > 0) {
    // Nearest portal centroid — drives the "approach → cross →
    // next room" cadence the tour planner builds on.
    let bestEdge = space.edges[0];
    let bestD2 = squaredDist(eye, bestEdge.position as Vec3);
    for (let i = 1; i < space.edges.length; i++) {
      const e = space.edges[i];
      const d2 = squaredDist(eye, e.position as Vec3);
      if (d2 < bestD2) { bestD2 = d2; bestEdge = e; }
    }
    return [...bestEdge.position] as Vec3;
  }
  // No portals — point along the longest-clear ray, anchored to
  // the eye + a unit step in that direction.
  return [
    eye[0] + bestDirFallback[0],
    eye[1] + bestDirFallback[1],
    eye[2] + bestDirFallback[2],
  ] as Vec3;
}


// ─── Math helpers ───────────────────────────────────────────────

function setHorizontalDir(dst: Vec3, theta: number, upAxis: 1 | 2): void {
  if (upAxis === 1) {
    dst[0] = Math.cos(theta);
    dst[1] = 0;
    dst[2] = Math.sin(theta);
  } else {
    dst[0] = Math.cos(theta);
    dst[1] = Math.sin(theta);
    dst[2] = 0;
  }
}

function makeHorizontalDir(theta: number, upAxis: 1 | 2): Vec3 {
  const v: Vec3 = [0, 0, 0] as Vec3;
  setHorizontalDir(v, theta, upAxis);
  return v;
}

function makePitchedDir(
    theta: number,
    pitch: number,
    upAxis: 1 | 2,
    horizAxes: [0 | 1 | 2, 0 | 1 | 2],
): Vec3 {
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const v: Vec3 = [0, 0, 0] as Vec3;
  v[horizAxes[0]] = cosP * Math.cos(theta);
  v[horizAxes[1]] = cosP * Math.sin(theta);
  v[upAxis]       = sinP;
  return v;
}

// ─── Yielding ───────────────────────────────────────────────────

/**
 * Cooperative yield — gives the host a beat between heavy space
 * batches so a Studio HUD can repaint while a large building is
 * being scored.
 */
function yieldToHost(): Promise<void> {
  if (typeof requestAnimationFrame === "function") {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
