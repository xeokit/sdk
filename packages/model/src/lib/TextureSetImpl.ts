import {TextureSetParams} from "@xeokit/core/components";

/**
 * @private
 */
export class TextureSetImpl implements TextureSetParams {

    textureSetId: string;
    colorTextureId: string;
    metallicRoughnessTextureId: string;
    occlusionTextureId: string;
    emissiveTextureId: string;

    constructor(textureSetParams: TextureSetParams) {
        this.textureSetId = textureSetParams.textureSetId;
        this.colorTextureId = textureSetParams.colorTextureId;
        this.metallicRoughnessTextureId = textureSetParams.metallicRoughnessTextureId;
        this.occlusionTextureId = textureSetParams.occlusionTextureId;
        this.emissiveTextureId = textureSetParams.emissiveTextureId;
    }
}