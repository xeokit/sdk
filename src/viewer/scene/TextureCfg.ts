import {FloatArrayType} from "../math/math";

/**
 * Texture creation parameters for {@link SceneModel.createTexture}.
 */
export interface TextureCfg {

    /**
     * ID for the texture.
     */
    id: string;

    /**
     * Path to an image file.
     */
    src?: string;

    /**
     * Transcoded texture data.
     */
    buffers?: ArrayBuffer[];

    /**
     * HTMLImage containing the texture image.
     */
    image?: HTMLImageElement;

    /**
     * How the texture is sampled when a texel covers more than one pixel.
     *
     * Supported values are {@link LinearFilter} and {@link NearestFilter}.
     */
    magFilter?: number;

    /**
     * How the texture is sampled when a texel covers less than one pixel.
     *
     * Supported values are {@link LinearMipmapLinearFilter}, {@link LinearMipMapNearestFilter},
     * {@link NearestMipMapNearestFilter}, {@link NearestMipMapLinearFilter}
     * and {@link LinearMipMapLinearFilter}.
     */
    minFilter?: number;

    /**
     * Wrap parameter for texture coordinate *S*.
     *
     * Supported values are {@link ClampToEdgeWrapping},
     * {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     */
    wrapS?: number;

    /**
     * Wrap parameter for texture coordinate *T*.
     *
     * Supported values are {@link ClampToEdgeWrapping},
     * {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     */
    wrapT?: number;

    /**
     * Wrap parameter for texture coordinate *R*.
     *
     * Supported values are {@link ClampToEdgeWrapping},
     * {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     */
    wrapR?: number;

    /**
     * Flips this Texture's source data along its vertical axis when ````true````.
     */
    flipY?: boolean;

    /**
     * Texture encoding format.
     *
     * Supported values are {@link LinearEncoding} and {@link sRGBEncoding}.
     */
    encoding?: number;

    /**
     * RGBA color to preload the texture with.
     */
    preloadColor?: FloatArrayType;
}