import type {FloatArrayParam} from "@xeokit/math/math";

/**
 * Represents a texture.
 *
 * * Stored in {@link Model.textures}
 * * Created with {@link BuildableModel.createTexture}
 * * Referenced by {@link TextureSet.colorTexture}, {@link TextureSet.metallicRoughnessTexture}, {@link TextureSet.occlusionTexture} and {@link TextureSet.emissiveTexture}
 */
export interface Texture {

    /**
     * ID for the texture.
     */
    id: string;

    /**
     * Path to an image file.
     */
    src?: string;

    /**
     * Image file data.
     */
    imageData?: any;

    /**
     * Transcoded texture data.
     */
    buffers?: ArrayBuffer[];

    /**
     * HTMLImage containing the texture image.
     */
    image?: HTMLImageElement;

    /**
     * Pixel height of the texture.
     */
    height: number;

    /**
     * Pixel width of the texture.
     */
    width: number;

    /**
     * True if the texture is compressed.
     */
    compressed: any;

    /**
     * Media type of this Texture.
     *
     * Supported values are {@link GIFMediaType}, {@link PNGMediaType} and {@link JPEGMediaType}.
     *
     * Ignored for compressed textures.
     */
    mediaType?: any;

    /**
     * How the texture is sampled when a texel covers more than one pixel.
     *
     * Supported values are {@link LinearFilter} and {@link NearestFilter}.
     */
    magFilter?: number;

    /**
     * How the texture is sampled when a texel covers less than one pixel. Supported values
     * are {@link LinearMipmapLinearFilter}, {@link LinearMipMapNearestFilter},
     * {@link NearestMipMapNearestFilter}, {@link NearestMipMapLinearFilter}
     * and {@link LinearMipMapLinearFilter}.
     *
     * Ignored for compressed textures.
     */
    minFilter?: number;

    /**
     * S wrapping mode.
     *
     * Supported values are {@link ClampToEdgeWrapping}, {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapS?: number;

    /**
     * T wrapping mode.
     *
     * Supported values are {@link ClampToEdgeWrapping}, {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapT?: number;

    /**
     * R wrapping mode.
     *
     * Supported values are {@link ClampToEdgeWrapping}, {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     *
     * Ignored for compressed textures.
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
    preloadColor?: FloatArrayParam;
}