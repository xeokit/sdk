import type {DrawingProjectionFace} from "./DrawingProjectionFace";
import type {DrawingProjectionRay} from "./DrawingProjectionRay";

/**
 * Projection direction. Either a face-name preset or a full
 * {forward, up?} ray for arbitrary / oblique projections.
 */
export type DrawingProjectionDirection =
  | DrawingProjectionFace
  | DrawingProjectionRay;
