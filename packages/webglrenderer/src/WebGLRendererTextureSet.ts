import type { RendererTextureSet} from "@xeokit/scene";
import type {WebGLRendererTexture} from "./WebGLRendererTexture";

/**
 * @private
 */
export class WebGLRendererTextureSet implements RendererTextureSet {

    public readonly id: string;
    public readonly colorRendererTexture: WebGLRendererTexture;
    public readonly metallicRoughnessRendererTexture: WebGLRendererTexture;
    public readonly emissiveRendererTexture: WebGLRendererTexture;
    public readonly occlusionRendererTexture: WebGLRendererTexture;

    constructor(params: {
        id: string;
        colorRendererTexture: WebGLRendererTexture;
        metallicRoughnessRendererTexture: WebGLRendererTexture;
        emissiveRendererTexture: WebGLRendererTexture;
        occlusionRendererTexture: WebGLRendererTexture;
    }) {
        this.id = params.id;
        this.colorRendererTexture = params.colorRendererTexture;
        this.metallicRoughnessRendererTexture = params.metallicRoughnessRendererTexture;
        this.emissiveRendererTexture = params.emissiveRendererTexture;
        this.occlusionRendererTexture = params.occlusionRendererTexture;
    }
}
