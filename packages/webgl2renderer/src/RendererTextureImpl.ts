import {Texture, RendererTexture} from "@xeokit/core/components";
import {Texture2D} from "@xeokit/webgl2";

/**
 * @private
 */
export class RendererTextureImpl implements RendererTexture{

    texture: Texture;
    texture2D: Texture2D;

    constructor(texture: Texture, texture2D: Texture2D) {
        this.texture = texture
        this.texture2D = texture2D;
    }

    destroy() {
        if (this.texture2D) {
            this.texture2D.destroy();
        }
    }


}
