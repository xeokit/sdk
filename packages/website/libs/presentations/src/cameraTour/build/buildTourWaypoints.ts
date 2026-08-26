/**
 * Smoothing leg of the {@link planCameraTour} pipeline — turns
 * the discrete `(space, viewpoint)` stops from a
 * {@link TourPlanner} into the final flat waypoint list a
 * playback engine drives the camera through.
 *
 * For each consecutive pair of stops, the smoother:
 *  - Emits the in-space stop as a {@link CameraTourWaypoint}
 *    carrying its dwell time, space id, and label.
 *  - **Inserts a portal-transit waypoint** between the pair when
 *    the two spaces are connected by a {@link SpaceGraphEdge}.
 *    Eye position is lifted to `floorElevation + eyeHeight` on
 *    the destination side; look-direction faces the destination
 *    centroid. `dwellMs = 0` so playback flows straight through
 *    the door rather than pausing mid-stride.
 *  - Skips the transit insertion when no portal connects the
 *    pair — these are tour "teleports" (different floors,
 *    disconnected components). The playback engine still
 *    interpolates between the two stops; it just won't try to
 *    thread a non-existent door.
 *
 * Spline fitting (C¹ continuous eye/look curves through the
 * waypoint list) is delegated to the playback step via the
 * existing
 * {@link viewing!cameraFlight.CameraPath | viewing.cameraFlight.CameraPath}
 * class, so the smoother itself stays purely combinatorial — no
 * curve math here.
 *
 * @internal
 */
import type {BuildTourWaypointsInput} from "./BuildTourWaypointsInput";
import type {BuildTourWaypointsResult} from "./BuildTourWaypointsResult";
import type {CameraTourWaypoint} from "../plan/CameraTourWaypoint";
import type {SpaceGraphEdge} from "../graph/SpaceGraphEdge";
import type {SpaceGraphNode} from "../graph/SpaceGraphNode";
import type {ViewpointGraph} from "../graph/ViewpointGraph";
import type {ViewpointGraphNode} from "../graph/ViewpointGraphNode";
import {resolveUpAxis} from "../internal/cameraTourMath";


/**
 * @internal
 */
export function buildTourWaypoints(
    input: BuildTourWaypointsInput,
): BuildTourWaypointsResult {

  const {stops, spaceGraph, viewpointGraph, options, up} = input;
  const waypoints: CameraTourWaypoint[] = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const space = spaceGraph.nodesById.get(stop.spaceNodeId);
    const viewpoint = lookupViewpoint(viewpointGraph, stop.viewpointNodeId);
    if (!space || !viewpoint) continue;   // defensive — planner produced an unknown id

    // Insert a portal-transit waypoint BEFORE this stop when the
    // previous stop is on the far side of a shared edge.
    if (i > 0) {
      const prev = spaceGraph.nodesById.get(stops[i - 1].spaceNodeId);
      const portal = prev && findPortal(prev, space);
      if (portal) {
        waypoints.push(buildPortalWaypoint(portal, space, options.eyeHeight, up));
      }
    }

    waypoints.push({
      position: cloneVec3(viewpoint.position),
      look:     cloneVec3(viewpoint.look),
      up:       cloneVec3(viewpoint.up),
      // `spaceId` carries the SpaceGraphNode id (always present) so
      // the playback engine can distinguish an in-space stop from a
      // synthesised portal-transit waypoint regardless of whether
      // the source space has a matching SceneObject (synthesised
      // IfcSpaces / geometry-fallback rooms have none).
      spaceId:      space.id,
      dataObjectId: space.dataObjectId,
      label:        space.label,
      dwellMs:      options.dwellMs,
    });
  }

  // Estimate: sum of in-waypoint dwells + per-leg flight.
  let dwellTotal = 0;
  for (const wp of waypoints) dwellTotal += wp.dwellMs ?? 0;
  const flightTotal = Math.max(0, waypoints.length - 1) * options.flightDurationMs;

  return {
    waypoints,
    estimatedDurationMs: dwellTotal + flightTotal,
  };
}


// ─── Helpers ─────────────────────────────────────────────────────

function lookupViewpoint(
    viewpointGraph: ViewpointGraph,
    id: string,
): ViewpointGraphNode | undefined {
  for (const vp of viewpointGraph.nodes) {
    if (vp.id === id) return vp;
  }
  return undefined;
}

/**
 * Find the {@link SpaceGraphEdge} (if any) bridging two spaces.
 * Scans `a.edges` since portal back-references are populated
 * symmetrically by the extractor.
 */
function findPortal(a: SpaceGraphNode, b: SpaceGraphNode): SpaceGraphEdge | null {
  for (const edge of a.edges) {
    if (edge.from === b.id || edge.to === b.id) return edge;
  }
  return null;
}

/**
 * Synthesise a portal-transit waypoint sitting at the door
 * centroid, at eye height on the destination side, facing the
 * destination room.
 */
function buildPortalWaypoint(
    portal: SpaceGraphEdge,
    destination: SpaceGraphNode,
    eyeHeight: number,
    up: [number, number, number],
): CameraTourWaypoint {
  const upAxis = resolveUpAxis(up);
  const eye: [number, number, number] = [
    portal.position[0], portal.position[1], portal.position[2],
  ];
  // Lift the eye to the destination's floor + eyeHeight, so the
  // through-door camera reads at standing height even when the
  // door centroid landed at mid-jamb height in the raw AABB.
  eye[upAxis] = destination.floorElevation + eyeHeight;

  // Look straight at the destination centroid — robust regardless
  // of which side authored the portal `normal`.
  const look: [number, number, number] = [
    destination.centroid[0],
    destination.centroid[1],
    destination.centroid[2],
  ];

  return {
    position: eye,
    look,
    up:       [up[0], up[1], up[2]],
    dwellMs:  0,
    // spaceId / dataObjectId left undefined — marks this as a
    // synthesised transit waypoint, not a planned stop.
  };
}

function cloneVec3(v: ArrayLike<number>): [number, number, number] {
  return [v[0], v[1], v[2]];
}
