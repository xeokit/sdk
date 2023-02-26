import type {FloatArrayParam} from "@xeokit/math/math";
import type {RendererTexture} from "./RendererTexture";

/**
 * Represents a texture.
 *
 * * Stored in {@link @xeokit/core/components!SceneModel.textures | SceneModel.textures}
 * * Created with {@link @xeokit/core/components!SceneModel.createTexture | SceneModel.createTexture}
 * * Referenced by {@link TextureSet.colorTexture | TextureSet.colorTexture},
 * {@link TextureSet.metallicRoughnessTexture | TextureSet.metallicRoughnessTexture},
 * {@link TextureSet.occlusionTexture | TextureSet.occlusionTexture} and {@link TextureSet.emissiveTexture | TextureSet.emissiveTexture}
 *
 * See usage in:
 *
 * * [@xeokit/scratchmodel](/docs/modules/_xeokit_scratchmodel.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 */
export interface Texture {

    /**
     *  Internal interface through which this {@link Texture} can load property updates into a renderer.
     *
     *  This is defined when the owner {@link SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTexture? : RendererTexture;

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



