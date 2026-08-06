import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import type {SceneGeometryParams} from "./SceneGeometryParams";
import type {SceneMeshParams} from "./SceneMeshParams";
import type {SceneObjectParams} from "./SceneObjectParams";
import type {SceneTextureParams} from "./SceneTextureParams";
import type {SceneMaterialParams} from "./SceneMaterialParams";
import type {CoordinateSystemParams} from "./CoordinateSystemParams";
import type  {  Vec3} from "../../base/math/vector";
import type  {Mat4} from "../../base/math/matrix";
import type {Quat} from "../../base/math/quat";
import type {SceneTransformParams} from "./SceneTransformParams";

/**
 * Hint describing how often a {@link model!scene.SceneModel | SceneModel}'s
 * renderer-facing values are expected to be uploaded after creation.
 *
 * Renderers can use this to choose storage for values such as matrices,
 * transforms, colors, visibility flags, opacity and object state. For example,
 * {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer} may favor
 * draw-time optimized VBO-backed batches for `"static"` models and
 * update-friendly data-texture-backed batches for `"dynamic"` models.
 */
export type SceneModelUpdateHint = "auto" | "static" | "dynamic";

/**
 * Describes whether a {@link model!scene.SceneModel | SceneModel}'s topology
 * remains open for growth, is loaded incrementally, or has been closed to new
 * components.
 */
export type SceneModelLifecycle = "open" | "streaming" | "sealed";

/**
 * Renderer allocation policy requested by a
 * {@link model!scene.SceneModel | SceneModel}.
 *
 * This is a hint, not a hard memory limit. It tells renderers whether they
 * should use their normal reusable storage strategy or allocate tightly around
 * finalized content.
 *
 * - `"stream"`: default. Use for open, streaming or editable models. Renderers
 *   may keep reusable backing stores that can accept more content without
 *   repacking.
 * - `"compact"`: use for sealed models or committed batches whose contents are
 *   expected to remain immutable. Renderers should allocate close to the
 *   current content size where supported.
 */
export type SceneModelMemoryPolicy = "stream" | "compact";

/**
 * Parameters for a {@link model!scene.SceneModel | SceneModel}.
 *
 * * Returned by {@link SceneModel.toParams | SceneModel.toParams}
 * * Passed to {@link SceneModel.fromParams | SceneModel.fromParams} and {@link Scene.createModel | Scene.createModel}
 *
 * See {@link scene | @xeokit/sdk/model/scene} for usage.
 */
export interface SceneModelParams {

  /**
   * Unique ID for the SceneModel.
   *
   * The SceneModel is stored with this ID in {@link Scene.models | Scene.models}
   */
  id?: string;

  /**
   * Configures the SceneModel's local coordinate system.
   *
   * By default, itis a right-handed Z-up coordinate system.
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
   * Hint describing how often this SceneModel's renderer-facing values are
   * expected to be uploaded.
   *
   * - `"auto"`: let the renderer choose its safe default.
   * - `"static"`: low runtime value upload rate, drawn many times; renderers
   *   may favor draw-time optimized storage such as VBO-backed batches.
   * - `"dynamic"`: frequent runtime uploads of matrices, transforms, colors or
   *   object state; renderers may favor update-friendly storage.
   *
   * Default is `"auto"`.
   */
  updateHint?: SceneModelUpdateHint;

  /**
   * Describes the model's construction lifecycle.
   *
   * - `"open"`: components can be added until the model is destroyed or sealed.
   * - `"streaming"`: components can continue to arrive over time; committed
   *   batches may be treated as immutable allocation units by renderers.
   * - `"sealed"`: the model is closed to new topology after initial creation.
   *
   * Default is `"open"`.
   */
  lifecycle?: SceneModelLifecycle;

  /**
   * Renderer allocation policy for this SceneModel.
   *
   * This controls whether renderers should prefer reusable backing stores or
   * tightly sized storage for internal resources such as VBOs, data textures
   * and renderer-side batch tables. It does not change the SceneModel's public
   * data, and it is not a strict heap budget.
   *
   * - `"stream"`: default. Use for models that can keep receiving components,
   *   batches or edits. Renderers may use their normal growable/reusable
   *   allocation strategy.
   * - `"compact"`: use for finalized models or committed streaming batches
   *   where memory footprint matters more than cheap future growth. Renderers
   *   should avoid avoidable slack when allocating storage for sealed models or
   *   committed batches.
   *
   * Default is `"stream"`.
   */
  memoryPolicy?: SceneModelMemoryPolicy;

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
  transforms?: SceneTransformParams[];

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
   * Parameters for {@link SceneMaterial  | SceneMaterials} in the {@link SceneModel | SceneModel}.
   */
  materials?: SceneMaterialParams[];

  /**
   * Parameters for {@link SceneMesh  | SceneMeshes} in the {@link SceneModel | SceneModel}.
   */
  meshes?: SceneMeshParams[];

  /**
   * Parameters for {@link SceneObject  | SceneObjects} in the {@link SceneModel | SceneModel}.
   */
  objects?: SceneObjectParams[];

  /**
   * If we want to view the SceneModel with a {@link viewing!viewer.Viewer | Viewer}, an
   * optional ID of the {@link viewing!viewer.ViewLayer | ViewLayer} to view the SceneModel in.
   *
   * Will be "default" by default.
   *
   * Overrides {@link SceneObjectParams.layerId | SceneObjectParams.layerId}.
   */
  layerId?: string;
}
