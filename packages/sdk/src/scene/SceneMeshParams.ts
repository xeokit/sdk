import type { FloatArrayParam } from "../math";

/**
 * Parameters for a {@link SceneMesh}.
 *
 * * Passed to  {@link SceneModel.createMesh | SceneModel.createMesh}
 * * Located at {@link SceneModelParams.meshes | SceneModelParams.meshes}
 *
 * See {@link scene | @xeokit/sdk/scene} for usage.
 */
export interface SceneMeshParams {

  /**
     * TODO
     */
  streamLayerIndex?: number;

  /**
     * ID for the new {@link SceneMesh}, unique within the {@link SceneModel | SceneModel}.
     */
  id: string;

  /**
     * ID of a {@link SceneTextureSet} that was created previously with {@link SceneModel.createTextureSet | SceneModel.createTextureSet}.
     */
  textureSetId?: string;

  /**
     * ID of a {@link SceneGeometry} that was created previously with {@link SceneModel.createGeometry | SceneModel.createGeometry} or {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}.
     */
  geometryId: string;

  /**
     * RGB base color of the new {@link SceneMesh}.
     *
     * * Default is ````[1,1,1]````.
     */
  color?: FloatArrayParam;

  /**
     * RGB pick color of the new {@link SceneMesh}.
     *
     * This is used internally within {@link SceneModel | SceneModel}.
     */
  pickColor?: FloatArrayParam;

  /**
     * Opacity of the new {@link SceneMesh}.
     *
     * Default is 1.
     */
  opacity?: number;

  /**
     * Optional local 3D translation vector.
     */
  position?: FloatArrayParam;

  /**
     * Optional local 3D scale vector.
     */
  scale?: FloatArrayParam;

  /**
     * Optional local 3D rotation quaternion.
     */
  quaternion?: FloatArrayParam;

  /**
     * Optional local 3D rotation as Euler angles given in degrees, for each of the X, Y and Z axis.
     */
  rotation?: FloatArrayParam;

  /**
     * Optional local 3D transform matrix.
     *
     * Overrides {@link SceneMeshParams.position}, {@link SceneMeshParams.scale | SceneMeshParams.scale},
     * {@link SceneMeshParams.quaternion | SceneMeshParams.quaternion}
     * and {@link SceneMeshParams.rotation | SceneMeshParams.rotation}.
     */
  matrix?: FloatArrayParam;

  /**
     * Relative-to-center (RTC) origin.
     *
     * When this is given, then {@link SceneMeshParams.matrix | SceneMeshParams.matrix} will be relative to this origin.
     */
  origin?:FloatArrayParam;
}
