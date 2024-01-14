import type {RendererTexture, SceneTexture} from "@xeokit/scene";
import type {WebGLTexture} from "@xeokit/webglutils";

/**
 * TODO
 * @internal
 */
export class WebGLRendererTexture implements RendererTexture {

    texture: SceneTexture | null;
    texture2D: WebGLTexture;

    /**
     * @private
     */
    constructor(texture: SceneTexture | null, texture2D: WebGLTexture) {
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
