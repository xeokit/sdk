import type {Vec3} from "../../base/math/vector";
import type {ModelLoadOptions} from "../ModelLoadOptions";

/**
 * Options for loading CityGML files.
 */
export interface CityGMLLoadOptions extends ModelLoadOptions {

  /**
   * Optional world-space origin to subtract from every parsed coordinate before
   * creating SceneGeometry.
   *
   * Use this for georeferenced CityGML files whose coordinates are far from
   * zero. Pair it with the same `SceneModel.coordinateSystem.origin` so geometry
   * is stored locally while the model remains positioned in its source CRS.
   */
  localOrigin?: Vec3;
}
