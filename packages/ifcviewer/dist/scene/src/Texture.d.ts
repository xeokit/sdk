import type { FloatArrayParam } from "@xeokit/math";
import type { RendererTexture } from "./RendererTexture";
import type { TextureParams } from "./TextureParams";
/**
 * A texture in a {@link @xeokit/viewer!Renderer}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.textures | SceneModel.textures}
 * * Created with {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture}
 * * Referenced by {@link TextureSet.colorTexture | TextureSet.colorTexture},
 * {@link TextureSet.metallicRoughnessTexture | TextureSet.metallicRoughnessTexture},
 * {@link TextureSet.occlusionTexture | TextureSet.occlusionTexture} and {@link TextureSet.emissiveTexture | TextureSet.emissiveTexture}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export declare class Texture {
    /**
     *  Internal interface through which this {@link Texture} can load property updates into a renderer.
     *
     *  This is defined when the owner {@link @xeokit/viewer!Renderer} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTexture: RendererTexture | null;
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
    compressed: boolean;
    /**
     * Media type of this Texture.
     *
     * Supported values are {@link @xeokit/constants!GIFMediaType}, {@link @xeokit/constants!PNGMediaType} and {@link @xeokit/constants!JPEGMediaType}.
     *
     * Ignored for compressed textures.
     */
    mediaType?: number;
    /**
     * How the texture is sampled when a texel covers more than one pixel.
     *
     * Supported values are {@link @xeokit/constants!LinearFilter} and {@link @xeokit/constants!NearestFilter}.
     */
    magFilter: number;
    /**
     * How the texture is sampled when a texel covers less than one pixel. Supported values
     * are {@link @xeokit/constants!LinearMipmapLinearFilter}, {@link @xeokit/constants!LinearMipMapNearestFilter},
     * {@link @xeokit/constants!NearestMipMapNearestFilter}, {@link @xeokit/constants!NearestMipMapLinearFilter}
     * and {@link @xeokit/constants!LinearMipMapLinearFilter}.
     *
     * Ignored for compressed textures.
     */
    minFilter: number;
    /**
     * S wrapping mode.
     *
     * Supported values are {@link @xeokit/constants!ClampToEdgeWrapping}, {@link @xeokit/constants!MirroredRepeatWrapping} and {@link @xeokit/constants!RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapS: number;
    /**
     * T wrapping mode.
     *
     * Supported values are {@link @xeokit/constants!ClampToEdgeWrapping}, {@link @xeokit/constants!MirroredRepeatWrapping} and {@link @xeokit/constants!RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapT: number;
    /**
     * R wrapping mode.
     *
     * Supported values are {@link @xeokit/constants!ClampToEdgeWrapping}, {@link @xeokit/constants!MirroredRepeatWrapping} and {@link @xeokit/constants!RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapR: number;
    /**
     * Flips this Texture's source data along its vertical axis when ````true````.
     */
    flipY: boolean;
    /**
     * Texture encoding format.
     *
     * Supported values are {@link @xeokit/constants!LinearEncoding} and {@link @xeokit/constants!sRGBEncoding}.
     */
    encoding: number;
    /**
     * RGBA color to preload the texture with.
     */
    preloadColor: FloatArrayParam;
    /**
     * @private
     */
    channel: number;
    /**
     * @private
     */
    constructor(params: TextureParams);
}
