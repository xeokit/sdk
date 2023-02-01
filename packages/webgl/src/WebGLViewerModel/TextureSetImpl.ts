import {TextureSet} from "@xeokit/core/components";

import type {TextureImpl} from "./TextureImpl";


/**
 * @private
 */
export class TextureSetImpl implements TextureSet {

    public readonly id: string;
    public readonly colorTexture: TextureImpl;
    public readonly metallicRoughnessTexture: TextureImpl;
    public readonly emissiveTexture: TextureImpl;
    public readonly occlusionTexture: TextureImpl;

    constructor(params: {
        id: string;
        colorTexture: TextureImpl;
        metallicRoughnessTexture: TextureImpl;
        emissiveTexture: TextureImpl;
        occlusionTexture: TextureImpl;
    }) {
        this.id = params.id;
        this.colorTexture = params.colorTexture;
        this.metallicRoughnessTexture = params.metallicRoughnessTexture;
        this.emissiveTexture = params.emissiveTexture;
        this.occlusionTexture = params.occlusionTexture;
    }
}
