import {Texture, RendererTexture} from "@xeokit/core/components";
import {GLTexture} from "@xeokit/webgl2";

/**
 * @private
 */
export class RendererTextureImpl implements RendererTexture{

    texture: Texture;
    texture2D: GLTexture;

    constructor(texture: Texture|null, texture2D: GLTexture) {
        this.texture = texture
        this.texture2D = texture2D;
    }

    destroy() {
        if (this.texture2D) {
            this.texture2D.destroy();
        }
    }


}
