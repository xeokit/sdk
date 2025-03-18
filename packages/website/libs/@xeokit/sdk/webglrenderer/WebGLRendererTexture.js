/**
 * @private
 */
export class WebGLRendererTexture {
    texture;
    texture2D;
    constructor(texture, texture2D) {
        this.texture = texture;
        this.texture2D = texture2D;
    }
    destroy() {
        if (this.texture2D) {
            this.texture2D.destroy();
        }
    }
}
//# sourceMappingURL=WebGLRendererTexture.js.map