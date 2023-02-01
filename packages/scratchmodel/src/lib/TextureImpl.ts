import {LinearMipMapNearestFilter, RepeatWrapping} from "@xeokit/core/constants";
import {Texture, TextureParams} from "@xeokit/core/components";

/**
 * @private
 */
export class TextureImpl implements Texture {

    id: string;
    imageData: any;
    src: any;
    compressed: any;
    height: number;
    width: number;
    mediaType: number;
    minFilter: number;
    magFilter: number;
    wrapS: number;
    wrapT: number;
    wrapR: number;

    constructor(params: TextureParams) {
        this.id = params.id;
        this.imageData = params.imageData;
        this.src = params.src;
        this.mediaType = params.mediaType;
        this.minFilter = params.minFilter || LinearMipMapNearestFilter;
        this.magFilter = params.magFilter || LinearMipMapNearestFilter;
        this.wrapS = params.wrapS || RepeatWrapping;
        this.wrapT = params.wrapT || RepeatWrapping;
        this.wrapR = params.wrapR || RepeatWrapping
    }
}

