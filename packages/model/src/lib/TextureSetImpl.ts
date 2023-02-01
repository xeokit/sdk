import {TextureSet, TextureSetParams} from "@xeokit/core/components";
import {TextureImpl} from "./TextureImpl";

/**
 * @private
 */
export class TextureSetImpl implements TextureSet {

    id: string;
    colorTexture?: TextureImpl;
    metallicRoughnessTexture?: TextureImpl
    occlusionTexture?: TextureImpl;
    emissiveTexture?: TextureImpl;

    constructor(textureSetParams: TextureSetParams,
                textures: {
                    emissiveTexture?: TextureImpl;
                    occlusionTexture?: TextureImpl;
                    metallicRoughnessTexture?: TextureImpl;
                    colorTexture?: TextureImpl;
                }) {

        this.id = textureSetParams.id;
        this.colorTexture = textures.colorTexture;
        this.metallicRoughnessTexture = textures.metallicRoughnessTexture;
        this.occlusionTexture = textures.occlusionTexture;
        this.emissiveTexture = textures.emissiveTexture;
    }
}