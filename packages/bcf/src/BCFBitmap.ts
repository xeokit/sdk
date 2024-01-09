import {BCFVector} from "./BCFVector";

/**
 * BCF bitmap.
 */
export interface BCFBitmap {

    /**
     * BCF bitmap type.
     */
    bitmap_type: string,

    /**
     * BCF bitmap data.
     */
    bitmap_data: string,

    /**
     * BCF bitmap location.
     */
    location: BCFVector,

    /**
     * BCF bitmap normal direction.
     */
    normal: { x: 0, y: 0, z: -1 },

    /**
     * BCF bitmap up direction.
     */
    up: { x: 0, y: -1, z: 0 },

    /**
     * BCF bitmap height.
     */
    height: 24
}