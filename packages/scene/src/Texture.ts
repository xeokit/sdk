import {
    ClampToEdgeWrapping,
    GIFMediaType,
    JPEGMediaType, LinearEncoding,
    LinearFilter,
    LinearMipmapLinearFilter,
    LinearMipMapLinearFilter,
    LinearMipMapNearestFilter,
    MirroredRepeatWrapping,
    NearestFilter,
    NearestMipMapLinearFilter,
    NearestMipMapNearestFilter,
    PNGMediaType,
    RepeatWrapping,
    sRGBEncoding
} from "@xeokit/core/constants";
import {FloatArrayParam} from "@xeokit/math/math";
import {RendererTexture} from "./RendererTexture";
import {TextureParams} from "./TextureParams";
import {createVec4} from "@xeokit/math/matrix";

/**
 * A texture in a {@link SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.textures | SceneModel.textures}
 * * Created with {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture}
 * * Referenced by {@link TextureSet.colorTexture | TextureSet.colorTexture},
 * {@link TextureSet.metallicRoughnessTexture | TextureSet.metallicRoughnessTexture},
 * {@link TextureSet.occlusionTexture | TextureSet.occlusionTexture} and {@link TextureSet.emissiveTexture | TextureSet.emissiveTexture}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export class Texture  {

    /**
     *  Internal interface through which this {@link Texture} can load property updates into a renderer.
     *
     *  This is defined when the owner {@link SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTexture?: RendererTexture;

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
     * Supported values are {@link GIFMediaType}, {@link PNGMediaType} and {@link JPEGMediaType}.
     *
     * Ignored for compressed textures.
     */
    mediaType?: number;

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

    /**
     * @private
     */
    channel?:number;

    /**
     * @private
     */
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
        this.rendererTexture = null;
        this.encoding = params.encoding || LinearEncoding;
        this.preloadColor = createVec4(params.preloadColor || [1, 1, 1, 1]);
        this.channel = 0;
    }
}

