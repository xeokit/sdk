import {Texture2D} from "../../lib/Texture2D";

/**
 * Instantiated by VBOSceneModel#createTexture
 *
 * @private
 */
export class WebGLVBOTexture {
    private id: any;
    private texture: Texture2D;

    constructor(cfg: { id: any; texture: Texture2D; }) {
        this.id = cfg.id;
        this.texture = cfg.texture;
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
