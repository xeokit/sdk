/**
 * {@link SceneMaterial} creation parameters for {@link SceneModel.createMaterial | SceneModel.createMaterial}.
 */
import {type Vec3} from "../math/vector";

export interface SceneMaterialParams {

  /**
   * ID for the texture set.
   */
  id: string;

  /**
   * Color of the material, as *RGB* components in the range 0.0 to 1.0.
   */
  color?: Vec3;

  /**
   * Opacity of the material, in the range 0.0 to 1.0.
   */
  opacity?: number;

  /**
   * Microfacet roughness used by the renderer's Cook-Torrance BRDF.
   *
   * `0` is mirror-smooth, `1` is fully diffuse. Only consulted on the
   * smooth-shaded path (geometry with per-vertex normals); flat-shaded
   * meshes ignore this value.
   *
   * Default is `0.6` — moderately rough, looks like painted plaster.
   */
  roughness?: number;

  /**
   * How metallic the surface is, in `[0, 1]`. `0` is a dielectric (plastic,
   * stone, paint); `1` is a pure metal whose diffuse term is suppressed
   * and whose Fresnel base reflectance is tinted by `color` (or by the
   * sampled colour texture, when one is bound).
   *
   * Only consulted on the smooth-shaded path.
   *
   * Default is `0.0`.
   */
  metallic?: number;

  /**
   * ID of a color texture created previously with {@link SceneModel.createTexture}.
   *
   * A color texture has color in *RGB* and alpha in *A*.
   */
  colorTextureId?: string;

  /**
   * ID of a metallic-roughness texture created previously with {@link SceneModel.createTexture}.
   *
   * A metallic-roughness texture has *RGBA* components, with the metallic factor in *R*, and the roughness factor in *G*.
   */
  metallicRoughnessTextureId?: string;

  /**
   * ID of an ambient occlusion texture created previously with {@link SceneModel.createTexture}.
   *
   * An occlusion texture has *RGBA* components, with occlusion factor in *R*,
   */
  occlusionTextureId?: string;

  /**
   * ID of a normal map texture created previously with {@link SceneModel.createTexture}.
   *
   * A normal map texture has *RGBA* components, with the normal map vectors in *RGB*.
   */
  normalsTextureId?: string;

  /**
   * ID of an emissive color texture created previously with {@link SceneModel.createTexture}.
   *
   * An emissive texture has *RGBA* components, with emissive factors in *RGB*.
   */
  emissiveTextureId?: string;

  /**
   * Alpha-handling mode (matches the glTF 2.0 `alphaMode` semantics):
   *
   *   - `"OPAQUE"` — alpha channel is ignored. Default.
   *   - `"MASK"`   — fragments with `albedoAlpha < alphaCutoff` are
   *                  discarded. Used for cutout foliage, fences, etc.
   *   - `"BLEND"`  — alpha contributes to the output and the fragment is
   *                  alpha-blended into the framebuffer.
   *
   * For `MASK` / `BLEND`, the alpha source is the A channel of the bound
   * `colorTexture` multiplied by `opacity`.
   */
  alphaMode?: "OPAQUE" | "MASK" | "BLEND";

  /**
   * Cut-off threshold used when `alphaMode` is `"MASK"`. Fragments with
   * `albedoAlpha < alphaCutoff` are discarded. Default is `0.5`.
   */
  alphaCutoff?: number;
}
