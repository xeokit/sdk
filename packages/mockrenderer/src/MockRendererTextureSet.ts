import type {RendererTextureSet} from "@xeokit/scene";
import type {MockRendererTexture} from "./MockRendererTexture";


/**
 * TODO
 *
 * @internal
 */
export class MockRendererTextureSet implements RendererTextureSet {

    public readonly id: string;
    public readonly colorRendererTexture: MockRendererTexture;
    public readonly metallicRoughnessRendererTexture: MockRendererTexture;
    public readonly emissiveRendererTexture: MockRendererTexture;
    public readonly occlusionRendererTexture: MockRendererTexture;

    constructor(params: {
        id: string;
        colorRendererTexture: MockRendererTexture;
        metallicRoughnessRendererTexture: MockRendererTexture;
        emissiveRendererTexture: MockRendererTexture;
        occlusionRendererTexture: MockRendererTexture;
    }) {
        this.id = params.id;
        this.colorRendererTexture = params.colorRendererTexture;
        this.metallicRoughnessRendererTexture = params.metallicRoughnessRendererTexture;
        this.emissiveRendererTexture = params.emissiveRendererTexture;
        this.occlusionRendererTexture = params.occlusionRendererTexture;
    }
}
