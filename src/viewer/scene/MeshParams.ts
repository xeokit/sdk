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
     * ID of a geometry that was created previously with {@link SceneModel.createGeometry}.
     */
    geometryId?: string;

    /**
     * Primitive type.
     *
     * Accepted values are {@link SolidPrimitive}, {@link SurfacePrimitive}, {@link LinesPrimitive}, {@link PointsPrimitive} and {@link TrianglesPrimitive}.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    primitive?: number;

    /**
     * Flat array of uncompressed floating point 3D vertex positions.
     *
     * Alternative to {@link MeshParams.positionsCompressed}.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    positions?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex positions.
     *
     * Alternative to {@link MeshParams.positions}.
     *
     * Requires {@link MeshParams.positionsDecompressMatrix}.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    positionsCompressed?: FloatArrayType;

    /**
     * Matrix to dequantize {@link MeshParams.positionsCompressed}.
     */
    positionsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point 3D vertex normals.
     *
     * Alternative to {@link MeshParams.normalsCompressed}.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    normals?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex normals.
     *
     * Alternative to {@link MeshParams.normals}.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    normalsCompressed?: FloatArrayType;

    /*
    * Flat array of uncompressed floating-point vertex UV coordinates.
    *
    * Alternative to {@link MeshParams.uvsCompressed}.
    *
    * Ignored when {@link MeshParams.geometryId} is defined.
    */
    uvs?: FloatArrayType;

    /*
    * Flat array of compressed integer vertex UV coordinates.
    *
    * Alternative to {@link MeshParams.uvs}.
    *
    * Requires {@link MeshParams.uvsDecompressMatrix}.
    *
    * Ignored when {@link MeshParams.geometryId} is defined.
    */
    uvsCompressed?: FloatArrayType;

    /**
     * Matrix to dequantize {@link MeshParams.uvsCompressed}.
     */
    uvsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point vertex colors.
     *
     * Alternative to {@link MeshParams.colorsCompressed}.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    colors?: FloatArrayType;

    /**
     * Flat array of compressed integer vertex colors.
     *
     * Alternative to {@link MeshParams.colorsCompressed}.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    colorsCompressed?: FloatArrayType;

    /**
     * Flat array of primitive connectivity indices.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    indices?: IntArrayType;

    /**
     * Flat array of edge connectivity indices.
     *
     * Ignored when {@link MeshParams.geometryId} is defined.
     */
    edgeIndices?: IntArrayType;

    /**
     * The threshold angle, in degrees, beyond which the deviation in normal directions of each pair of adjacent faces
     * results in an edge being automatically generated between them.
     *
     * Ignored when {@link MeshParams.edgeIndices} or {@link MeshParams.geometryId} is defined.
     *
     * Default is 10.
     */
    edgeThreshold?: number;

    /**
     * RGB base color of the mesh.
     *
     * Default is ````[1,1,1]````.
     */
    color?: FloatArrayType;

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