import type {RendererTexture, Texture} from "@xeokit/scene";
import type {GLTexture} from "@xeokit/webglutils";

/**
 * TODO
 * @internal
 */
export class WebGLRendererTexture implements RendererTexture {

    texture: Texture | null;
    texture2D: GLTexture;

    /**
     * @private
     */
    constructor(texture: Texture | null, texture2D: GLTexture) {
        this.texture = texture
        this.texture2D = texture2D;
    }

    /**
     * @private
     */
    destroy() {
        if (this.texture2D) {
            this.texture2D.destroy();
        }
    }
}
