import {BCFVector} from "./BCFVector";

/**
 * BCF orthogonal camera.
 */
export interface BCFOrthogonalCamera {

    /**
     * BCF orthogonal camera viewpoint.
     */
    camera_view_point: BCFVector;

    /**
     * BCF orthogonal camera direction.
     */
    camera_direction: BCFVector;

    /**
     * BCF orthogonal camera "up".
     */
    camera_up_vector: BCFVector;

    /**
     * BCF orthogonal camera view-to-world scale.
     */
    view_to_world_scale: number;

}