import type { Texture } from "./Texture";
/**
 * Instantiated internally by Model#createTextureSet
 */
export declare class TextureSet {
    readonly id: number | string;
    readonly colorTexture: Texture;
    readonly metallicRoughnessTexture: Texture;
    readonly normalsTexture: Texture;
    readonly emissiveTexture: Texture;
    readonly occlusionTexture: Texture;
    constructor(params: {
        id: number | string;
        colorTexture: Texture;
        metallicRoughnessTexture: Texture;
        normalsTexture: Texture;
        emissiveTexture: Texture;
        occlusionTexture: Texture;
    });
}
