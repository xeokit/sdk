import type {Vec3} from "../../../base/math/vector";
import type {MaterialPixelBuffer} from "./MaterialPixelBuffer";

/**
 * The PBR material-texture set produced by each painter in
 * {@link procgen/paintMaterials}, plus an optional flat-context
 * fallback pair the same painter can use to declare how the
 * material should read **without** texture sampling.
 *
 *   - `color`  — albedo / base-colour map. Upload as sRGB.
 *   - `normal` — tangent-space normal map. Upload as linear; encodes
 *                a unit normal as `(x*0.5+0.5, y*0.5+0.5, z*0.5+0.5)`.
 *   - `mr`     — metallic-roughness map. Upload as linear; `R` is
 *                unused, `G = roughness`, `B = metallic` (glTF
 *                convention).
 *
 * All three maps share the same square dimensions and are
 * {@link MaterialPixelBuffer}s. Pass each directly to
 * `SceneModel.createTexture({ imageData: ... })`.
 *
 * `flatColor` and `flatOpacity` are the painter's representation
 * intent for textureless contexts — 2D drawings, swatches,
 * low-zoom LOD, BCF thumbnails. They are **authored**, not
 * pixel-derived: a hatched brick texture's pixel mean is a
 * muddy grey, but the painter knows the brick should read as
 * warm red on a plan. Consumers that want a flat colour read
 * these first and only fall back to the colour texture's
 * centre pixel when both are absent.
 */
export interface MaterialMaps {
  color: MaterialPixelBuffer;
  normal: MaterialPixelBuffer;
  mr: MaterialPixelBuffer;

  /**
   * Representative sRGB colour for textureless contexts. Each
   * channel `[0, 1]`. Painters typically pick the dominant
   * ink / fill colour rather than averaging the texture, so a
   * brick wall reads as red and a tile floor as the tile
   * colour rather than the grout-and-tile average.
   *
   * Undefined → consumer falls back to its own default
   * (typically the centre-pixel sample of `color`).
   */
  flatColor?: Vec3;

  /**
   * Author's intended opacity for textureless contexts.
   * `0` = fully transparent, `1` = opaque. Default `1`.
   *
   * Lets a glass painter ship "blue × 0.35" so the same
   * material reads as a translucent window in 3D and a
   * thin-line wireframe in a plan drawing. Has no
   * relationship to the colour texture's alpha channel —
   * this is a single scalar for the whole material.
   */
  flatOpacity?: number;
}
