import type {FloatArrayParam} from "@xeokit/math";

/**
 * {@link @xeokit/scene!SceneMesh} creation parameters for {@link @xeokit/scene!SceneModel.createMesh | SceneModel.createMesh}.
 */
export interface SceneMeshParams {

    /**
     * TODO
     */
    streamLayerIndex?: number;

    /**
     * ID for the new {@link @xeokit/scene!SceneMesh}, unique within the {@link @xeokit/scene!SceneModel | SceneModel}.
     */
    id: string;

    /**
     * ID of a {@link @xeokit/scene!SceneTextureSet} that was created previously with {@link @xeokit/scene!SceneModel.createTextureSet | SceneModel.createTextureSet}.
     */
    textureSetId?: string;

    /**
     * ID of a {@link @xeokit/scene!SceneGeometry} that was created previously with {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry} or {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}.
     */
    geometryId: string;

    /**
     * RGB base color of the new {@link @xeokit/scene!SceneMesh}.
     *
     * * Default is ````[1,1,1]````.
     */
    color?: FloatArrayParam;

    /**
     * RGB pick color of the new {@link @xeokit/scene!SceneMesh}.
     *
     * This is used internally within {@link @xeokit/scene!SceneModel | SceneModel}.
     */
    pickColor?: FloatArrayParam;

    /**
     * Opacity of the new {@link @xeokit/scene!SceneMesh}.
     *
     * Default is 1.
     */
    opacity?: number;

    /**
     * The metallic-ness of new {@link @xeokit/scene!SceneMesh}.
     *
     * * This is a continuous factor in the range ````[0,1]````, where 0 is fully non-metallic and 1 is fully metallic.
     * * Default is 0.
     * * See [*Physically-Based Rendering*](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#physically-based-rendering)
     */
    metallic?: number;

    /**
     * The roughness of new {@link @xeokit/scene!SceneMesh}.
     *
     * * This is a continuous factor in the range ````[0,1]````, where 0 is fully rough and 1 is perfectly smooth.
     * * Default is 1.
     * * See [*Physically-Based Rendering*](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#physically-based-rendering)
     */
    roughness?: number;

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
     * Overrides {@link @xeokit/scene!SceneMeshParams.position}, {@link @xeokit/scene!SceneMeshParams.scale | SceneMeshParams.scale},
     * {@link @xeokit/scene!SceneMeshParams.quaternion | SceneMeshParams.quaternion}
     * and {@link @xeokit/scene!SceneMeshParams.rotation | SceneMeshParams.rotation}.
     */
    matrix?: FloatArrayParam;

    /**
     * TODO
     */
    rtcMatrix?:FloatArrayParam;
}
