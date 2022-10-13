import {Texture} from "./Texture";

/**
 * Instantiated by Model#createTextureSet
 *
 * @private
 */
export class TextureSet {

    public readonly id: number | string;
    public readonly colorTexture: Texture;
    public readonly metallicRoughnessTexture: Texture;
    public readonly normalsTexture: Texture;
    public readonly emissiveTexture: Texture;
    public readonly occlusionTexture: Texture;

    constructor(params: {
        id: number | string;
        colorTexture: Texture;
        metallicRoughnessTexture: Texture;
        normalsTexture: Texture;
        emissiveTexture: Texture;
        occlusionTexture: Texture;
    }) {
        this.id = params.id;
        this.colorTexture = params.colorTexture;
        this.metallicRoughnessTexture = params.metallicRoughnessTexture;
        this.normalsTexture = params.normalsTexture;
        this.emissiveTexture = params.emissiveTexture;
        this.occlusionTexture = params.occlusionTexture;
    }
}
