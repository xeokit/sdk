
import type {Vec4} from "../../base/math/vector";

/**
 * Raw pixel buffer accepted as `SceneTextureParams.imageData`. Either
 * the DOM `ImageData` type itself, or a JSON-serializable plain object
 * carrying the same fields (the constructor normalises the plain form
 * into an `ImageData` so the renderer always sees the canonical type).
 */
export interface SceneTexturePixelBuffer {
  data: Uint8Array<any> | Uint8ClampedArray<any> | number[];
  width: number;
  height: number;
}

/**
 * Runtime-decoded image source accepted as `SceneTextureParams.image`.
 * These are the four object forms WebGL2's `texSubImage2D` accepts
 * directly, so the renderer can hand them straight to the GPU without
 * an intermediate decode.
 */
export type SceneTextureImageSource =
  HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | OffscreenCanvas;

/**
 * {@link SceneTexture} creation parameters for {@link SceneModel.createTexture | SceneModel.createTexture}.
 */
export interface SceneTextureParams {

  /**
   * ID for the texture.
   */
  id: string;

  /**
   * URL to fetch the image from. Any URL form is accepted —
   * `http(s):`, `blob:`, or `data:`. A canvas serialised via
   * `canvas.toDataURL()` belongs here, not in `imageData`.
   */
  src?: string;

  /**
   * Raw pixel buffer with explicit dimensions. JSON-serialisable
   * params produced by {@link SceneTexture.toParams} use the plain
   * `{ data, width, height }` form; the constructor normalises that
   * back into a DOM `ImageData` for the renderer.
   *
   * Use {@link SceneTextureParams.image} for already-decoded
   * canvas / image / ImageBitmap inputs.
   */
  imageData?: ImageData | SceneTexturePixelBuffer;

  /**
   * Transcoded / compressed texture data, decoded by the runtime
   * transcoder pipeline before upload.
   */
  buffers?: ArrayBuffer[];

  /**
   * Already-decoded image source the renderer can hand straight to
   * `texSubImage2D`. Pass canvases, `HTMLImageElement`s,
   * `ImageBitmap`s, and `OffscreenCanvas`es here.
   */
  image?: SceneTextureImageSource;

  /**
   * Pixel width of the texture. Required when the texture is supplied as
   * encoded/transcoded buffers without a decoded image source.
   */
  width?: number;

  /**
   * Pixel height of the texture. Required when the texture is supplied as
   * encoded/transcoded buffers without a decoded image source.
   */
  height?: number;

  /**
   * True when {@link buffers} contains GPU-compressed/transcoded texture data
   * rather than standard PNG/JPEG/GIF bytes.
   */
  compressed?: boolean;

  /**
   * Media type.
   */
  mediaType?: any;

  /**
   * How the texture is sampled when a texel covers more than one pixel.
   *
   * Supported values are {@link base!constants.LinearFilter | LinearFilter} and {@link base!constants.NearestFilter | NearestFilter}.
   */
  magFilter?: number;

  /**
   * How the texture is sampled when a texel covers less than one pixel.
   *
   * Supported values are {@link base!constants.LinearMipmapLinearFilter | LinearMipmapLinearFilter}, {@link base!constants.LinearMipMapNearestFilter | LinearMipMapNearestFilter},
   * {@link base!constants.NearestMipMapNearestFilter | NearestMipMapNearestFilter}, {@link base!constants.NearestMipMapLinearFilter | NearestMipMapLinearFilter}
   * and {@link base!constants.LinearMipMapLinearFilter | LinearMipMapLinearFilter}.
   */
  minFilter?: number;

  /**
   * Wrap parameter for texture coordinate *S*.
   *
   * Supported values are {@link base!constants.ClampToEdgeWrapping | ClampToEdgeWrapping},
   * {@link base!constants.MirroredRepeatWrapping | MirroredRepeatWrapping} and {@link base!constants.RepeatWrapping | RepeatWrapping}.
   */
  wrapS?: number;

  /**
   * Wrap parameter for texture coordinate *T*.
   *
   * Supported values are {@link base!constants.ClampToEdgeWrapping | ClampToEdgeWrapping},
   * {@link base!constants.MirroredRepeatWrapping | MirroredRepeatWrapping} and {@link base!constants.RepeatWrapping | RepeatWrapping}.
   */
  wrapT?: number;

  /**
   * Wrap parameter for texture coordinate *R*.
   *
   * Supported values are {@link base!constants.ClampToEdgeWrapping | ClampToEdgeWrapping},
   * {@link base!constants.MirroredRepeatWrapping | MirroredRepeatWrapping} and {@link base!constants.RepeatWrapping | RepeatWrapping}.
   */
  wrapR?: number;

  /**
   * Flips this SceneTexture's source data along its vertical axis when ````true````.
   */
  flipY?: boolean;

  /**
   * SceneTexture encoding format.
   *
   * Supported values are {@link base!constants.LinearEncoding | LinearEncoding} and {@link base!constants.sRGBEncoding | sRGBEncoding}.
   */
  encoding?: number;

  /**
   * RGBA color to preload the texture with.
   */
  preloadColor?: Vec4;

  /**
   * Opt this texture into mipmapped sampling. When `true`, the
   * renderer routes meshes whose materials reference this
   * SceneTexture into a mipmap-bearing batch — the per-batch
   * atlas is allocated with a full mip pyramid and sampled with
   * `LINEAR_MIPMAP_LINEAR`, eliminating shimmer at distance and
   * grazing angles.
   *
   * Default `false` — mipmaps cost about 33% extra atlas memory
   * and the renderer regenerates the whole atlas pyramid on every
   * slice add (cheap when textures are uploaded once at load,
   * noticeable past ~100 streamed-in textures).
   *
   * Caveat: a material that binds a mix of opted-in and
   * non-opted-in textures lands its meshes in a single mipped
   * batch — the non-opted-in textures end up in a mipped atlas
   * too. In practice, opt every map of a material in or out
   * together.
   */
  mipmap?: boolean;
}
