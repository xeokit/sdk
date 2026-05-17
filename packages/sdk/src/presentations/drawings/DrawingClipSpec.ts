import type {Vec3} from "../../base/math/vector";

/**
 * Cut-away clip plane spec. See {@link DrawingProjectionParams.clip}
 * for the two shapes (`{depth}` for a basis-aligned section,
 * `{point, normal}` for arbitrary diagonal cuts).
 */
export type DrawingClipSpec =
  | { depth: number }
  | { point: Vec3; normal: Vec3 };
