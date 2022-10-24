import {Texture2D} from "../../lib/Texture2D";

/**
 * Instantiated by VBOSceneModel#createTexture
 *
 * @private
 */
export class Texture {
    private id: any;
    private texture: Texture2D;

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
            this.texture = null;
        }
    }
}
