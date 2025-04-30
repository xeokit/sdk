import type { FloatArrayParam } from "../math";

import type { SceneGeometryCompressedParams } from "./SceneGeometryCompressedParams";
import type { SceneTextureParams } from "./SceneTextureParams";
import type { SceneTextureSetParams } from "./SceneTextureSetParams";

import type { SceneMeshParams } from "./SceneMeshParams";
import type { SceneGeometryParams } from "./SceneGeometryParams";
import type { SceneObjectParams } from "./SceneObjectParams";
import { SceneModelStreamParams } from "./SceneModelStreamParams";

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
     * Indicates what renderer resources will need to be allocated in a {@link viewer!Viewer | Viewer's}
     * {@link viewer!Renderer | Renderer} to support progressive loading for a {@link SceneModel | SceneModel}.
     */
  streamParams?: SceneModelStreamParams;

  /**
     * Unique ID for the SceneModel.
     *
     * The SceneModel is stored with this ID in {@link Scene.models | Scene.models}
     */
  id: string;

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
  matrix?: FloatArrayParam;

  /**
     * Scale of the SceneModel.
     *
     * Default is ````[1,1,1]````.
     */
  scale?: FloatArrayParam;

  /**
     * Quaternion defining the orientation of the SceneModel.
     */
  quaternion?: FloatArrayParam;

  /**
     * Orientation of the SceneModel, given as Euler angles in degrees for X, Y and Z axis.
     */
  rotation?: FloatArrayParam;

  /**
     * World-space position of the SceneModel.
     */
  position?: FloatArrayParam;

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

  /**
     * Whether this SceneModel retains its {@link SceneObject | SceneObjects}, {@link SceneMesh | SceneMeshes},
     * {@link SceneGeometry | SceneGeometries} etc. after we call {@link SceneModel.build | SceneModel.build}.
     *
     * Default value is `true`.
     */
  retained?: boolean;

  /**
     * The axis-aligned 3D World-space boundary of the {@link SceneModel | SceneModel}.
     *
     * This is created by {@link SceneModel.toParams | SceneModel.toParams} to provide the SceneModel's
     * boundary, and is ignored by {@link SceneModel.fromParams | SceneModel.fromParams} and the SceneModel
     * constructor.
     */
  aabb?: number[]
}
