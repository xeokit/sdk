import type {SceneTexture} from "../../../scene";


/** Result of {@link paintHeatMapPoint}. */
export interface PaintHeatMapPointResult {

  /** SceneTexture whose `imageData` was mutated. */
  texture: SceneTexture;

  /** Texel coordinates of the brush centre (may be off-texture). */
  centerTexel: [number, number];

  /**
   * Inclusive bounding box of mutated texels — `[x0, y0, x1, y1]`
   * clamped to the texture. Empty range (`x1 < x0`) when the brush
   * landed entirely off-texture.
   */
  bounds: [number, number, number, number];
}
