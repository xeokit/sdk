
import type {Vec3, Vec9} from "../../base/math/vector";

/**
 * Describes the coordinate system, origin, and unit system in which a 3D model was authored.
 * This provides the spatial context necessary to correctly interpret and transform model geometry
 * into a common viewer space.
 */
export interface CoordinateSystemParams {

  /**
   * The basis vectors defining the local coordinate system,
   * stored as a flat 9-element array in column-major format:
   * [ x0, x1, x2, y0, y1, y2, z0, z1, z2 ]
   * Each axis should be a normalized vector.
   */
  basis: Vec9;

  /**
   * The origin of the coordinate system in global space.
   */
  origin: Vec3;

  /**
   * The unit of measurement used in coordinates.
   * This is required to interpret distances and scales correctly.
   */
  units: 'meters' | 'millimeters' | 'inches' | 'feet';

  /**
   * Optional: a multiplier to convert units into meters.
   * If not specified, a default will be assumed based on the `units` field.
   * Example: 0.3048 for feet, 0.001 for millimeters.
   */
  scaleToMeters?: number;
}


