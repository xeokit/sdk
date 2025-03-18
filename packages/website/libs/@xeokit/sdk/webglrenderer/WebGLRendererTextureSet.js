/**
 * @private
 */
export class WebGLRendererTextureSet {
    id;
    colorRendererTexture;
    metallicRoughnessRendererTexture;
    emissiveRendererTexture;
    occlusionRendererTexture;
    constructor(params) {
        this.id = params.id;
        this.colorRendererTexture = params.colorRendererTexture;
        this.metallicRoughnessRendererTexture = params.metallicRoughnessRendererTexture;
        this.emissiveRendererTexture = params.emissiveRendererTexture;
        this.occlusionRendererTexture = params.occlusionRendererTexture;
    }
}
//# sourceMappingURL=WebGLRendererTextureSet.js.map