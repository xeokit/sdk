import {BCFVector} from "./BCFVector";

/**
 * BCF line segment.
 */
export interface BCFLine {

    /**
     * BCF line segment start point.
     */
    "start_point": BCFVector,

    /**
     * BCF line segment end point.
     */
    "end_point": BCFVector
}