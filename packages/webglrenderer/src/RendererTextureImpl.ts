import type {RendererTexture, Texture} from "@xeokit/scene";
import type {GLTexture} from "@xeokit/webglutils";

/**
 * @private
 */
export class RendererTextureImpl implements RendererTexture {

    texture: Texture | null;
    texture2D: GLTexture;

    constructor(texture: Texture | null, texture2D: GLTexture) {
        this.texture = texture
        this.texture2D = texture2D;
    }

    destroy() {
        if (this.texture2D) {
            this.texture2D.destroy();
        }
    }


}
