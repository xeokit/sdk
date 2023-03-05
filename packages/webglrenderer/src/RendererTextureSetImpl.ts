import { RendererTextureSet} from "@xeokit/scene";
import {RendererTextureImpl} from "./RendererTextureImpl";


/**
 * @private
 */
export class RendererTextureSetImpl implements RendererTextureSet {

    public readonly id: string;
    public readonly colorTexture: RendererTextureImpl;
    public readonly metallicRoughnessTexture: RendererTextureImpl;
    public readonly emissiveTexture: RendererTextureImpl;
    public readonly occlusionTexture: RendererTextureImpl;

    constructor(params: {
        id: string;
        colorTexture: RendererTextureImpl;
        metallicRoughnessTexture: RendererTextureImpl;
        emissiveTexture: RendererTextureImpl;
        occlusionTexture: RendererTextureImpl;
    }) {
        this.id = params.id;
        this.colorTexture = params.colorTexture;
        this.metallicRoughnessTexture = params.metallicRoughnessTexture;
        this.emissiveTexture = params.emissiveTexture;
        this.occlusionTexture = params.occlusionTexture;
    }
}
