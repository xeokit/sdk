import {Texture, TextureParams} from "@xeokit/core/components";
import {LinearMipMapNearestFilter, RepeatWrapping} from "@xeokit/core/constants";
import type {Texture2D} from "../lib/Texture2D";



/**
 * @private
 */
export class TextureImpl implements Texture {

    id: any;
    texture: Texture2D;
    imageData: any;
    magFilter: number;
    mediaType: number;
    minFilter: number;
    src: any;
    wrapR: number;
    wrapS: number;
    wrapT: number;

    compressed: any;
    height: number;
    width: number;

    constructor(textureParams: TextureParams, texture: Texture2D) {
        this.id = textureParams.id;
        this.imageData = textureParams.imageData;
        this.src = textureParams.src;
        this.mediaType = textureParams.mediaType;
        this.minFilter = textureParams.minFilter || LinearMipMapNearestFilter;
        this.magFilter = textureParams.magFilter || LinearMipMapNearestFilter;
        this.wrapS = textureParams.wrapS || RepeatWrapping;
        this.wrapT = textureParams.wrapT || RepeatWrapping;
        this.wrapR = textureParams.wrapR || RepeatWrapping
        this.texture = texture;
    }

    /**
     * @private
     */
    destroy() {
        if (this.texture) {
            this.texture.destroy();
        }
    }


}
