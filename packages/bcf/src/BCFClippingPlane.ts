import {BCFVector} from "./BCFVector";

/**
 * BCF clipping plane.
 */
export interface BCFClippingPlane {

    /**
     * BCF clipping plane bitmap MIME type.
     */
    bitmap_type?: string,

    /**
     * BCF clipping plane bitmap data.
     */
    bitmap_data?: string,

    /**
     * BCF clipping plane location.
     */
    location: BCFVector,

    /**
     * BCF clipping plane direction.
     */
    direction: BCFVector,

    /**
     * BCF clipping plane up direction.
     */
    up: BCFVector,

    /**
     * BCF clipping plane height.
     */
    height: number
}