import {FloatArrayType, IntArrayType} from "../math/math";

/**
 * Mesh creation parameters for {@link SceneModel.createMesh}.
 */
export interface MeshCfg {

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
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    primitive?: number;

    /**
     * Flat array of uncompressed floating point 3D vertex positions.
     *
     * Alternative to {@link MeshCfg.positionsCompressed}.
     *
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    positions?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex positions.
     *
     * Alternative to {@link MeshCfg.positions}.
     *
     * Requires {@link MeshCfg.positionsDecompressMatrix}.
     *
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    positionsCompressed?: FloatArrayType;

    /**
     * Matrix to dequantize {@link MeshCfg.positionsCompressed}.
     */
    positionsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point 3D vertex normals.
     *
     * Alternative to {@link MeshCfg.normalsCompressed}.
     *
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    normals?: FloatArrayType;

    /**
     * Flat array of compressed integer 3D vertex normals.
     *
     * Alternative to {@link MeshCfg.normals}.
     *
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    normalsCompressed?: FloatArrayType;

    /*
    * Flat array of uncompressed floating-point vertex UV coordinates.
    *
    * Alternative to {@link MeshCfg.uvsCompressed}.
    *
    * Ignored when {@link MeshCfg.geometryId} is defined.
    */
    uvs?: FloatArrayType;

    /*
    * Flat array of compressed integer vertex UV coordinates.
    *
    * Alternative to {@link MeshCfg.uvs}.
    *
    * Requires {@link MeshCfg.uvsDecompressMatrix}.
    *
    * Ignored when {@link MeshCfg.geometryId} is defined.
    */
    uvsCompressed?: FloatArrayType;

    /**
     * Matrix to dequantize {@link MeshCfg.uvsCompressed}.
     */
    uvsDecompressMatrix?: FloatArrayType;

    /**
     * Flat array of uncompressed floating-point vertex colors.
     *
     * Alternative to {@link MeshCfg.colorsCompressed}.
     *
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    colors?: FloatArrayType;

    /**
     * Flat array of compressed integer vertex colors.
     *
     * Alternative to {@link MeshCfg.colorsCompressed}.
     *
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    colorsCompressed?: FloatArrayType;

    /**
     * Flat array of primitive connectivity indices.
     *
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    indices?: IntArrayType;

    /**
     * Flat array of edge connectivity indices.
     *
     * Ignored when {@link MeshCfg.geometryId} is defined.
     */
    edgeIndices?: IntArrayType;

    /**
     * The threshold normal deviation between adjacent faces above which an edge is generated between them.
     *
     * Ignored when {@link MeshCfg.edgeIndices} or {@link MeshCfg.geometryId} is defined.
     */
    edgeThreshold?: number;

    /**
     * RGB base color of the mesh.
     */
    color?: FloatArrayType;

    /**
     * Opacity of the mesh.
     */
    opacity?: number;

    /**
     * The metallic-ness of the mesh.
     *
     * This is a continuous factor in the range ````[0,1]````, where 0 is fully non-metallic and 1 is fully metallic.
     */
    metallic?: number;

    /**
     * The roughness of the mesh.
     *
     * This is a continuous factor in the range ````[0,1]````, where 0 is fully rough and 1 is perfectly smooth.
     */
    roughness?: number;

    /**
     * Optional 3D World-space origin, relative to {@link SceneModel.origin}.
     *
     * When this is given, then 3D positions given in {@link MeshCfg.positions} or
     * {@link MeshCfg.positionsCompressed} are assumed to be relative to this.
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
     * Overrides {@link MeshCfg.position}, {@link MeshCfg.scale}, {@link MeshCfg.quaternion} and {@link MeshCfg.rotation}.
     */
    matrix?: FloatArrayType;
}