import type {Texture2D} from "../lib/Texture2D";

/**
 * Instantiated internally by W{@link WebGLSceneModel.createTexture}.
 */
export class Texture {
    id: any;
    texture: Texture2D;

    constructor(params: { id: any; texture: Texture2D; }) {
        this.id = params.id;
        this.texture = params.texture;
    }

    /**
     * @private
     */
    destroy() {
        if (this.texture) {
            this.texture.destroy();
        }
    }
}
