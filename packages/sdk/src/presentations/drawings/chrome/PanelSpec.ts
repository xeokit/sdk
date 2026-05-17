import type {Vec3} from "../../../base/math/vector";
import type {MaterialMaps} from "../../../model/procgen/paintMaterials/MaterialMaps";

/**
 * Translucent backing quad behind the wireframe projection.
 */
export interface PanelSpec {
  /**
   * RGB tint applied to the panel. When {@link PanelSpec.paint}
   * is also supplied, this multiplies the painter's colour
   * texture. Default `[1, 1, 1]` (white — let the painter
   * speak) when a painter is set; `[0.96, 0.97, 0.99]`
   * otherwise.
   */
  color?: Vec3;

  /** Opacity in `[0, 1]`. Default `0.55`. */
  opacity?: number;

  /**
   * Optional PBR painter — a zero-arg callback returning a
   * {@link MaterialMaps} triple (colour + normal + metallic-
   * roughness). When provided, the projector creates the
   * three textures and a SceneMaterial inside the target
   * SceneModel and binds the panel mesh to it.
   *
   * The painter is called once per `buildDrawing` call.
   * Cache the maps yourself if you're projecting onto multiple
   * faces and want them to share one underlying texture set.
   */
  paint?: () => MaterialMaps;

  /**
   * World-space texture repeat distance, in scene units per
   * tile. Forwarded to the SceneMaterial as `triplanarScale`,
   * so the panel quad (which has no UVs) samples the painter's
   * textures via the renderer's triplanar fallback. Default
   * `1.0`.
   */
  textureScale?: number;
}
