import {LinearMipMapNearestFilter, RepeatWrapping} from "@xeokit/core/constants";
import {Texture, TextureParams} from "@xeokit/core/components";

/**
 * @private
 */
export class TextureImpl implements Texture {

    /**
     * Unique ID of this Texture in {@link Model#textures}.
     */
    textureId: string;

    /**
     * Texture image data.
     */
    imageData: any;

    /**
     * Texture file source.
     */
    src: any;

    /**
     * Media type of this Texture.
     *
     * Supported values are {@link GIFMediaType}, {@link PNGMediaType} and {@link JPEGMediaType}.
     *
     * Ignored for compressed textures.
     */
    mediaType: number;

    /**
     * How the texture is sampled when a texel covers less than one pixel. Supported values
     * are {@link LinearMipmapLinearFilter}, {@link LinearMipMapNearestFilter},
     * {@link NearestMipMapNearestFilter}, {@link NearestMipMapLinearFilter}
     * and {@link LinearMipMapLinearFilter}.
     *
     * Ignored for compressed textures.
     */
    minFilter: number;

    /**
     * How the texture is sampled when a texel covers more than one pixel. Supported values
     * are {@link LinearFilter} and {@link NearestFilter}.
     *
     * Ignored for compressed textures.
     */
    magFilter: number;

    /**
     * S wrapping mode.
     *
     * Supported values are {@link ClampToEdgeWrapping}, {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapS: number;

    /**
     * T wrapping mode.
     *
     * Supported values are {@link ClampToEdgeWrapping}, {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapT: number;

    /**
     * R wrapping mode.
     *
     * Supported values are {@link ClampToEdgeWrapping}, {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapR: number;

    /**
     * @private
     */
    constructor(textureParams: TextureParams) {
        this.textureId = textureParams.textureId;
        this.imageData = textureParams.imageData;
        this.src = textureParams.src;
        this.mediaType = textureParams.mediaType;
        this.minFilter = textureParams.minFilter || LinearMipMapNearestFilter;
        this.magFilter = textureParams.magFilter || LinearMipMapNearestFilter;
        this.wrapS = textureParams.wrapS || RepeatWrapping;
        this.wrapT = textureParams.wrapT || RepeatWrapping;
        this.wrapR = textureParams.wrapR || RepeatWrapping
    }
}

