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
} from "../constants";
import {createVec4} from "../matrix";
import type {FloatArrayParam} from "../math";
import type {SceneTextureParams} from "./SceneTextureParams";
import {SceneModel} from "./SceneModel";
import {SDKErrorType} from "../core";

/**
 * A texture in a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.textures | SceneModel.textures}
 * * Created with {@link SceneModel.createTexture | SceneModel.createTexture}
 * * Referenced by {@link SceneTextureSet.colorTexture | SceneTextureSet.colorTexture},
 * {@link SceneTextureSet.metallicRoughnessTexture | SceneTextureSet.metallicRoughnessTexture},
 * {@link SceneTextureSet.occlusionTexture | SceneTextureSet.occlusionTexture} and {@link SceneTextureSet.emissiveTexture | SceneTextureSet.emissiveTexture}
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneTexture {

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
   * Supported values are {@link constants!GIFMediaType}, {@link constants!PNGMediaType} and {@link constants!JPEGMediaType}.
   *
   * Ignored for compressed textures.
   */
  mediaType?: number;

  /**
   * How the texture is sampled when a texel covers more than one pixel.
   *
   * Supported values are {@link constants!LinearFilter} and {@link constants!NearestFilter}.
   */
  magFilter: number;

  /**
   * How the texture is sampled when a texel covers less than one pixel. Supported values
   * are {@link constants!LinearMipmapLinearFilter}, {@link constants!LinearMipMapNearestFilter},
   * {@link constants!NearestMipMapNearestFilter}, {@link constants!NearestMipMapLinearFilter}
   * and {@link constants!LinearMipMapLinearFilter}.
   *
   * Ignored for compressed textures.
   */
  minFilter: number;

  /**
   * S wrapping mode.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
   *
   * Ignored for compressed textures.
   */
  wrapS: number;

  /**
   * T wrapping mode.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
   *
   * Ignored for compressed textures.
   */
  wrapT: number;

  /**
   * R wrapping mode.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
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
   * Supported values are {@link constants!LinearEncoding} and {@link constants!sRGBEncoding}.
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
   * The SceneModel that this texture belongs to.
   */
  public model: SceneModel;

  /**
   * True if this SceneTexture has been destroyed.
   */
  public destroyed: boolean = false;

  /**
   * @private
   */
  constructor(sceneModel: SceneModel, params: SceneTextureParams) {
    this.model = sceneModel;
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
  }

  /**
   * Destroy this SceneTexture.
   */
  destroy() {
    if (this.destroyed) {
        return;
    }
    //  TODO: Null any TextureSet references to this texture
    this.image = undefined;
    this.imageData = undefined;
    this.buffers = undefined;
    this.model._destroyTexture(this);
    this.destroyed = true;
  }
}

