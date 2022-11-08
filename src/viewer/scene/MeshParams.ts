import {FloatArrayType, IntArrayType} from "../math/math";

/**
 * Mesh creation parameters for {@link SceneModel.createMesh}.
 */
export interface MeshParams {

    /**
     * ID for the mesh, unique within the {@link SceneModel}.
     */
    id?: string;

    /**
     * ID of a texture set that was created previously with {@link SceneModel.createTextureSet}.
     */
    textureSetId?: string;

    /**
     * ID of a geometry that was created previously with {@link SceneModel.createGeometry} or {@link SceneModel.createGeometryCompressed}.
     */
    geometryId?: string;

    /**
     * Optional ID of a {@link Transform} previously created with {@link SceneModel.createTransform}.
     */
    transformId?: string;

    /**
     * RGB base color of the mesh.
     *
     * Default is ````[1,1,1]````.
     */
    color?: FloatArrayType;

    /**
     * RGB pick color of the mesh.
     *
     * This is used internally within {@link SceneModel}.
     */
    pickColor?: FloatArrayType;

    /**
     * Opacity of the mesh.
     *
     * Default is 1.
     */
    opacity?: number;

    /**
     * The metallic-ness of the mesh.
     *
     * This is a continuous factor in the range ````[0,1]````, where 0 is fully non-metallic and 1 is fully metallic.
     *
     * Default is 0.
     */
    metallic?: number;

    /**
     * The roughness of the mesh.
     *
     * This is a continuous factor in the range ````[0,1]````, where 0 is fully rough and 1 is perfectly smooth.
     *
     * Default is 1.
     */
    roughness?: number;

    /**
     * Optional 3D World-space origin, relative to {@link SceneModel.origin}.
     *
     * When this is given, then 3D positions given in {@link MeshParams.positions} or
     * {@link MeshParams.positionsCompressed} are assumed to be relative to this.
     */
    origin?: FloatArrayType;

    /**
     * Optional local 3D translation vector.
     */
    position?: FloatArrayType;

    /**
     * Optional local 3D scale vector.
     */
    scale?: FloatArrayType;

    /**
     * Optional local 3D rotation quaternion.
     */
    quaternion?: FloatArrayType;

    /**
     * Optional local 3D rotation as Euler angles given in degrees, for each of the X, Y and Z axis.
     */
    rotation?: FloatArrayType;

    /**
     * Optional local 3D transform matrix.
     *
     * Overrides {@link MeshParams.position}, {@link MeshParams.scale}, {@link MeshParams.quaternion} and {@link MeshParams.rotation}.
     */
    matrix?: FloatArrayType;
}