import {
    ClampToEdgeWrapping,
    GIFMediaType,
    JPEGMediaType,
    LinearEncoding,
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
} from "@xeokit/constants";
import type {FloatArrayParam} from "@xeokit/math";
import type {RendererTexture} from "./RendererTexture";
import type {SceneTextureParams} from "./SceneTextureParams";
import {createVec4} from "@xeokit/matrix";

/**
 * A texture in a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.textures | SceneModel.textures}
 * * Created with {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture}
 * * Referenced by {@link @xeokit/scene!SceneTextureSet.colorTexture | SceneTextureSet.colorTexture},
 * {@link @xeokit/scene!SceneTextureSet.metallicRoughnessTexture | SceneTextureSet.metallicRoughnessTexture},
 * {@link @xeokit/scene!SceneTextureSet.occlusionTexture | SceneTextureSet.occlusionTexture} and {@link @xeokit/scene!SceneTextureSet.emissiveTexture | SceneTextureSet.emissiveTexture}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneTexture {

    /**
     *  Internal interface through which this {@link @xeokit/scene!SceneTexture} can load property updates into a renderers.
     *
     *  This is defined when the owner {@link @xeokit/scene!SceneModel | SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
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
     * Media type of this SceneTexture.
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
     * Flips this SceneTexture's source data along its vertical axis when ````true````.
     */
    flipY: boolean;

    /**
     * SceneTexture encoding format.
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
    constructor(params: SceneTextureParams) {
        this.id = params.id;
        this.imageData = params.imageData;
        this.src = params.src;
        this.mediaType = params.mediaType;
        this.minFilter = params.minFilter || LinearMipMapNearestFilter;
        this.magFilter = params.magFilter || LinearMipMapNearestFilter;
        this.wrapS = params.wrapS || RepeatWrapping;
        this.wrapT = params.wrapT || RepeatWrapping;
        this.wrapR = params.wrapR || RepeatWrapping
        this.encoding = params.encoding || LinearEncoding;
        this.preloadColor = createVec4(params.preloadColor || [1, 1, 1, 1]);
        this.channel = 0;
        this.rendererTexture = null;
    }
}

