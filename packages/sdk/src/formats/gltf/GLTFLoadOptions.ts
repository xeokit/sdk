import type {Mat4} from "../../base/math/matrix";
import type {ModelLoadOptions} from "../ModelLoadOptions";

/**
 * Options for {@link GLTFLoader.load | GLTFLoader.load}, extending the shared
 * {@link ModelLoadOptions} with glTF-specific concerns.
 */
export interface GLTFLoadOptions extends ModelLoadOptions {

  /**
   * Optional 4×4 transform (column-major) pre-multiplied into every node's
   * world matrix, placing the content without baking the transform into shared
   * geometry.
   */
  rootMatrix?: Mat4;

  /**
   * Optional Draco decoder module (`draco3d`), injected by the caller to decode
   * `KHR_draco_mesh_compression` content. The SDK does not bundle the Draco
   * WASM itself; when omitted, Draco-compressed content cannot be decoded.
   *
   * ```ts
   * import draco3d from "draco3d";
   * loader.load(params, { dracoModule: draco3d });
   * ```
   */
  dracoModule?: any;

  /**
   * Optional parent DataObject id under which per-feature metadata DataObjects
   * (from `EXT_structural_metadata`) are aggregated.
   */
  dataParentId?: string;

  /**
   * Retain each texture's original encoded image bytes (the source PNG/JPEG)
   * on the SceneTexture so exporters can re-emit them losslessly without
   * re-encoding via a 2D canvas (which is unavailable under Node). Off by
   * default — the viewer renders from the decoded image and the extra bytes
   * are wasted memory. Conversion tools that re-export the model set this.
   */
  retainTextureBytes?: boolean;
}
