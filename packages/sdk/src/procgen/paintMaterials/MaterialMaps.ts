import type {MaterialPixelBuffer} from "./MaterialPixelBuffer";

/**
 * The PBR material-texture set produced by each painter in
 * {@link procgen/paintMaterials}.
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
 */
export interface MaterialMaps {
  color: MaterialPixelBuffer;
  normal: MaterialPixelBuffer;
  mr: MaterialPixelBuffer;
}
