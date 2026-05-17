import type  {Mat4} from "../../base/math/matrix";
import type  {Vec3, Vec4} from "../../base/math/vector";
import type {Quat} from "../../base/math/quat";
/**
 * Parameters for a {@link model!scene.SceneMesh | SceneMesh}.
 *
 * * Passed to  {@link SceneModel.createMesh | SceneModel.addMesh}
 * * Located at {@link SceneModelParams.meshes | SceneModelParams.meshes}
 *
 * See {@link scene | @xeokit/sdk/model/scene} for usage.
 */
export interface SceneMeshParams {

  /**
   * ID for the new {@link model!scene.SceneMesh | SceneMesh}, unique within the {@link SceneModel | SceneModel}.
   */
  id: string;

  /**
   * ID of the parent {@link SceneTransform} that was created previously with {@link SceneModel.createTransform | SceneModel.createTransform}.
   */
  parentTransformId?: string;

  /**
   * ID of a {@link model!scene.SceneMaterial | SceneMaterial} that was created previously with {@link SceneModel.createMaterial | SceneModel.createMaterial}.
   */
  materialId?: string;

  /**
   * ID of a {@link model!scene.SceneGeometry | SceneGeometry} that was created previously with {@link SceneModel.createGeometry | SceneModel.createGeometry} or {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}.
   */
  geometryId: string;

  /**
   * RGB base color of the new {@link model!scene.SceneMesh | SceneMesh}.
   *
   * * Default is ````[1,1,1]````.
   */
  color?: Vec3;

  /**
   * Opacity of the new {@link model!scene.SceneMesh | SceneMesh}.
   *
   * Default is 1.
   */
  opacity?: number;

  /**
   * Optional local 3D translation vector.
   */
  position?: Vec3;

  /**
   * Optional local 3D scale vector.
   */
  scale?: Vec3;

  /**
   * Optional local 3D rotation quaternion.
   */
  quaternion?: Quat;

  /**
   * Optional local 3D rotation as Euler angles given in degrees, for each of the X, Y and Z axis.
   */
  rotation?: Vec3;

  /**
   * Optional local 3D transform matrix.
   *
   * Overrides {@link SceneMeshParams.position}, {@link SceneMeshParams.scale | SceneMeshParams.scale},
   * {@link SceneMeshParams.quaternion | SceneMeshParams.quaternion}
   * and {@link SceneMeshParams.rotation | SceneMeshParams.rotation}.
   */
  matrix?: Mat4;

  /**
   * Relative-to-center (RTC) origin.
   *
   * When this is given, then {@link SceneMeshParams.matrix | SceneMeshParams.matrix} will be relative to this origin.
   */
  origin?: Vec3;

  /**
   * Free-form bin identifier the SceneMesh belongs to. Frozen after
   * construction.
   *
   * The scene assigns no semantics to `bin` on its own — it is a tag
   * the caller stamps on a SceneMesh for downstream consumers to
   * group by. A **renderer** — were it rendering this scene — is
   * expected to honour the tag as follows:
   *
   * - Partition the visible SceneMeshes by `bin` value (a missing or
   *   empty `bin` is treated as the implicit "default" group).
   * - Process the groups in an order the renderer documents. For
   *   example, a renderer may choose to draw the default group first
   *   and then any meshes tagged `"overlay"` after, with the depth
   *   buffer cleared between groups so the overlay group reads as
   *   "floating" on top of the rest of the scene.
   * - Honour any per-bin policy the renderer documents (e.g. depth
   *   clearing, depth-test enabled / disabled, picking priority).
   *
   * The tag lives on {@link SceneMesh | SceneMesh} rather than
   * {@link SceneObject | SceneObject} because renderable batching
   * happens at mesh granularity — a SceneMesh can be drawn by a
   * renderer without ever being assigned to a SceneObject, so this is
   * the layer at which bin membership is meaningful. Tools that
   * consume the scene but do not render it — model builders,
   * exporters, format converters, structural inspectors — may use
   * `bin` as a free-form classification, or ignore it. Loaders and
   * exporters round-trip the value verbatim.
   */
  bin?: string;
}
