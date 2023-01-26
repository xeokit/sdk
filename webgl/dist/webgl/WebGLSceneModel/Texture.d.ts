import type { Texture2D } from "../lib/Texture2D";
/**
 * Instantiated internally by W{@link WebGLViewerModel.createTexture}.
 */
export declare class Texture {
    id: any;
    texture: Texture2D;
    constructor(params: {
        id: any;
        texture: Texture2D;
    });
    /**
     * @private
     */
    destroy(): void;
}
