import type {Vec3} from "@xeokit/sdk/base/math/vector";

/**
 * Orthonormal `{right, up, forward}` basis used throughout the
 * projection pipeline. Pixel u grows along `right`, pixel v
 * grows along `up`, and the camera looks along `forward` from
 * (conceptually) `-infinity`. All three vectors are unit
 * length and mutually orthogonal.
 */
export interface ProjectionBasis {

  /**
   * Image-plane right axis, unit length. Pixel u grows along this.
   */
  right: Vec3;

  /**
   * Image-plane up axis, unit length. Pixel v grows along this.
   */
  up: Vec3;

  /**
   * Camera-look direction, unit length.
   */
  forward: Vec3;
}
