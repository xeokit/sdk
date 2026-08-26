import type {SDKResult} from "../../base/core";
import type {Vec3} from "../../base/math/vector";
import type {
  SceneGeometry,
  SceneMaterial,
  SceneMesh,
  SceneModel,
  SceneObject,
  SceneRepRangeParams,
  SceneRepSet,
  SceneRepSetSelectionParams
} from "../scene";
import type {ShellGenerationParams} from "./ShellGenerationParams";
import type {ShellGenerator, ShellGeneratorResult} from "./ShellGenerator";

/**
 * Parameters for creating a shell representation set in a SceneModel.
 *
 * The created representation set has two representations:
 *
 * - a detailed representation referencing the supplied source SceneObjects
 * - a shell representation referencing one generated shell SceneObject
 *
 * All referenced SceneObjects belong to the same SceneModel. The helper does
 * not create cross-model representation sets.
 *
 * @public
 */
export interface ShellRepParams {
  /**
   * SceneModel that owns the source objects, generated shell object and
   * resulting representation set.
   */
  model: SceneModel;

  /**
   * Representation set ID to create.
   */
  id: string;

  /**
   * Source SceneObject IDs for the detailed representation.
   */
  objectIds: string[];

  /**
   * Optional shell generator. Defaults to a new {@link ShellGenerator}.
   */
  generator?: ShellGenerator;

  /**
   * Shell generation settings.
   */
  generation?: ShellGenerationParams;

  /**
   * ID for the detailed representation.
   *
   * Default is `"detailed"`.
   */
  detailedRepId?: string;

  /**
   * ID for the shell representation.
   *
   * Default is `"shell"`.
   */
  shellRepId?: string;

  /**
   * Declarative selection hints for the created representation set.
   */
  selection?: SceneRepSetSelectionParams;

  /**
   * Projected-size range for the detailed representation.
   */
  detailedRange?: SceneRepRangeParams;

  /**
   * Projected-size range for the shell representation.
   */
  shellRange?: SceneRepRangeParams;

  /**
   * ID for the generated shell geometry.
   *
   * Default is `"shellGeometry:${id}"`.
   */
  shellGeometryId?: string;

  /**
   * ID for the generated shell mesh.
   *
   * Default is `"shellMesh:${id}"`.
   */
  shellMeshId?: string;

  /**
   * ID for the generated shell SceneObject.
   *
   * Default is `"shellObject:${id}"`.
   */
  shellObjectId?: string;

  /**
   * ID for the shell material.
   *
   * Default is `"shellMaterial"`.
   */
  shellMaterialId?: string;

  /**
   * Shell material/mesh color.
   *
   * Default is `[0.72, 0.76, 0.78]`.
   */
  shellColor?: Vec3;

  /**
   * Shell material/mesh opacity.
   *
   * Default is `1`.
   */
  shellOpacity?: number;
}

/**
 * Result from creating a shell representation set.
 *
 * @public
 */
export interface ShellRepResult {
  /**
   * Generated shell data.
   */
  shell: ShellGeneratorResult;

  /**
   * Created representation set.
   */
  repSet: SceneRepSet;

  /**
   * Generated shell geometry.
   */
  geometry: SceneGeometry;

  /**
   * Generated shell mesh.
   */
  mesh: SceneMesh;

  /**
   * Generated shell SceneObject.
   */
  object: SceneObject;

  /**
   * Shell material. This might be an existing material reused by ID.
   */
  material: SceneMaterial;
}

/**
 * Function signature for shell representation creation.
 *
 * @public
 */
export type ShellRepCreator = (params: ShellRepParams) => SDKResult<ShellRepResult>;
