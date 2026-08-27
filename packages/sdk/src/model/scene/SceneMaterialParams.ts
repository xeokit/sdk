/**
 * {@link model!scene.SceneMaterial | SceneMaterial} creation parameters for {@link SceneModel.createMaterial | SceneModel.createMaterial}.
 */
import {type Vec3} from "../../base/math/vector";
import type {LineStyle} from "./linePattern";
import type {HatchStyle, HatchParams} from "./hatchPattern";

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
   * Emissive color factor, as *RGB* components in the range 0.0 to 1.0.
   *
   * Multiplied against {@link SceneMaterialParams.emissiveTextureId | the
   * emissive texture} (glTF `emissiveFactor` semantics). Defaults to
   * `[0, 0, 0]` (no emission) — except that {@link SceneModel.createMaterial}
   * auto-defaults it to `[1, 1, 1]` when an emissive texture is present, so a
   * textured material glows without restating the factor.
   */
  emissiveColor?: Vec3;

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
   * Strength of a dielectric clearcoat layer above the base material, in
   * `[0, 1]`.
   *
   * Matches scalar glTF `KHR_materials_clearcoat.clearcoatFactor`
   * semantics. `0` disables the layer; `1` applies the full coat. Only
   * consulted on the smooth-shaded Cook-Torrance path.
   *
   * Default is `0.0`.
   */
  clearcoat?: number;

  /**
   * Microfacet roughness for the clearcoat layer, in `[0, 1]`.
   *
   * Matches scalar glTF
   * `KHR_materials_clearcoat.clearcoatRoughnessFactor` semantics. Lower
   * values produce tighter secondary highlights; higher values broaden
   * them. Only consulted when {@link SceneMaterialParams.clearcoat} is
   * greater than zero.
   *
   * Default is `0.0`.
   */
  clearcoatRoughness?: number;

  /**
   * Strength of a soft fabric-like sheen lobe above the base material, in
   * `[0, 1]`.
   *
   * Matches scalar glTF `KHR_materials_sheen.sheenColorFactor` semantics by
   * using one grayscale factor for all colour channels. `0` disables sheen;
   * `1` applies the full lobe. Only consulted on the smooth-shaded
   * Cook-Torrance path.
   *
   * Default is `0.0`.
   */
  sheen?: number;

  /**
   * Roughness for the scalar sheen lobe, in `[0, 1]`.
   *
   * Matches glTF `KHR_materials_sheen.sheenRoughnessFactor` semantics. Lower
   * values give a tighter grazing highlight; higher values broaden it. Only
   * consulted when {@link SceneMaterialParams.sheen} is greater than zero.
   *
   * Default is `0.5`.
   */
  sheenRoughness?: number;

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

  /**
   * Pixel thickness for line-primitive meshes that carry this
   * material. Consumed by the thick-line draw technique, which
   * quad-expands every line in the vertex shader and offsets
   * each side by half this width.
   *
   * Default `0`, which means "fall back to the View's
   * `linesMaterial.lineWidth`". Setting a positive value
   * overrides that fallback per-material so different
   * line-primitive meshes can be drawn at different thicknesses
   * in the same View.
   */
  lineWidth?: number;

  /**
   * Dash / gap pattern for line-primitive meshes that carry
   * this material. Accepts either a named preset from
   * {@link LineStyle} or a custom `[dash, gap, dash, gap, …]`
   * array (up to 8 entries, units of line-width).
   *
   * Pattern entries are measured in line-width units so visual
   * proportions stay constant as `lineWidth` changes:
   * `[3, 2]` reads as "dash 3 × lineWidth, gap 2 × lineWidth".
   *
   * Default is `"solid"` — continuous line. Setting any other
   * value overrides the View-level lines-material pattern for
   * meshes that carry this material, so engineering conventions
   * (hidden, centre, phantom) can be mixed within a single
   * drawing.
   *
   * Affects visual appearance only; picking treats the line as
   * continuous regardless of the pattern.
   */
  linePattern?: LineStyle | number[];

  /**
   * Hatch pattern for triangle-surface meshes that carry this
   * material. Accepts either a named preset from
   * {@link HatchStyle} or a {@link HatchParams} object that
   * specifies one to four line families plus a hatch ink colour
   * and opacity.
   *
   * Hatches are the engineering analog of {@link linePattern}:
   * they paint a regular set of parallel ink lines over the
   * lit surface to indicate a material class (concrete,
   * steel, brick, masonry) on a cross-section or elevation
   * drawing. Patterns are applied in screen space — the lines
   * stay at constant pixel thickness and spacing regardless of
   * surface depth or orientation.
   *
   * Default is `"solid"` — no hatch, surface renders normally.
   *
   * Affects visual appearance only; picking treats the surface
   * as continuous regardless of the pattern.
   */
  hatchPattern?: HatchStyle | HatchParams;

  /**
   * World-space repeat distance used by a renderer's *triplanar*
   * texture-sampling fallback, in scene units per texture repeat.
   *
   * Triplanar fallback should engage automatically for any mesh that
   * carries this material when the mesh's geometry has no UV
   * coordinates — typical of BIM, sweeps, lofted pipes, and
   * generated curve meshes. Each fragment derives its sample
   * coordinates from world-space position rather than vertex UVs,
   * so the texture appears at a fixed physical scale regardless
   * of mesh scale or geometry layout.
   *
   * Materials whose meshes all carry UVs ignore this value.
   *
   * Default is `1.0` — one texture repeat per scene unit.
   */
  triplanarScale?: number;
}
