import {BCFVector} from "./BCFVector";

/**
 * BCF perspective camera.
 */
export interface BCFPerspectiveCamera {

    /**
     * BCF perspective camera viewpoint.
     */
    camera_view_point: BCFVector,

    /**
     * BCF perspective camera direction.
     */
    camera_direction: BCFVector,

    /**
     * BCF perspective camera "up".
     */
    camera_up_vector: BCFVector,

    /**
     * BCF perspective camera field-of-view.
     */
    field_of_view: number
}