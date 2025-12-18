import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import type {SceneGeometryParams} from "./SceneGeometryParams";
import type {SceneMeshParams} from "./SceneMeshParams";
import type {SceneObjectParams} from "./SceneObjectParams";
import type {SceneTextureParams} from "./SceneTextureParams";
import type {SceneTextureSetParams} from "./SceneTextureSetParams";
import type {CoordinateSystemParams} from "./CoordinateSystemParams";
import {SceneTransform} from "./SceneTransform";
import type  {Mat4, Quat, Vec3} from "../matrix";

/**
 * Parameters for a {@link SceneModel}.
 *
 * * Returned by {@link SceneModel.toParams | SceneModel.toParams}
 * * Passed to {@link SceneModel.fromParams | SceneModel.fromParams} and {@link Scene.createModel | Scene.createModel}
 *
 * See {@link scene | @xeokit/sdk/scene} for usage.
 */
export interface SceneModelParams {

  /**
   * Unique ID for the SceneModel.
   *
   * The SceneModel is stored with this ID in {@link Scene.models | Scene.models}
   */
  id: string;

  /**
   * Configures the SceneModel's local coordinate system.
   */
  coordinateSystem?: CoordinateSystemParams;

  /**
   * Whether IDs of the {@link SceneObject | SceneObjects} are globalized.
   *
   * When globalized, the IDs are prefixed with the value of {@link SceneModel.id | SceneModel.id}
   *
   * Default is ````false````.
   */
  globalizedIds?: boolean

  /**
   * 4x4 transform matrix.
   */
  matrix?: Mat4;

  /**
   * Scale of the SceneModel.
   *
   * Default is ````[1,1,1]````.
   */
  scale?: Vec3;

  /**
   * Quaternion defining the orientation of the SceneModel.
   */
  quaternion?: Quat;

  /**
   * Orientation of the SceneModel, given as Euler angles in degrees for X, Y and Z axis.
   */
  rotation?: Vec3;

  /**
   * World-space position of the SceneModel.
   */
  position?: Vec3;

  /**
   * Parameters for {@link SceneTransform  | SceneTransforms} in the {@link SceneModel | SceneModel}.
   */
  transforms?: SceneTransform[];

  /**
   * Parameters for {@link SceneGeometry  | SceneGeometries} in the {@link SceneModel | SceneModel}.
   */
  geometries?: SceneGeometryParams[];

  /**
   * Compressed parameters for {@link SceneGeometry  | SceneGeometries} in the {@link SceneModel | SceneModel}.
   */
  geometriesCompressed?: SceneGeometryCompressedParams[];

  /**
   * Parameters for {@link SceneTexture  | SceneTextures} in the {@link SceneModel | SceneModel}.
   */
  textures?: SceneTextureParams[];

  /**
   * Parameters for {@link SceneTextureSet  | SceneTextureSets} in the {@link SceneModel | SceneModel}.
   */
  textureSets?: SceneTextureSetParams[];

  /**
   * Parameters for {@link SceneMesh  | SceneMeshes} in the {@link SceneModel | SceneModel}.
   */
  meshes?: SceneMeshParams[];

  /**
   * Parameters for {@link SceneObject  | SceneObjects} in the {@link SceneModel | SceneModel}.
   */
  objects?: SceneObjectParams[];

  /**
   * If we want to view the SceneModel with a {@link viewer!Viewer | Viewer}, an
   * optional ID of the {@link viewer!ViewLayer | ViewLayer} to view the SceneModel in.
   *
   * Will be "default" by default.
   *
   * Overrides {@link SceneObjectParams.layerId | SceneObjectParams.layerId}.
   */
  layerId?: string;
}
