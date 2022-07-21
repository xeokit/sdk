import {Scene} from "./Scene";
import {FloatArrayType, IntArrayType} from "../math/index";
import {SceneObject} from "./SceneObject";
import {SceneTransform} from "./SceneTransform";
import {
    LinearFilter,
    LinearMipmapLinearFilter,
    NearestMipMapLinearFilter,
    RepeatWrapping,
    LinearEncoding,
    sRGBEncoding,
    NearestMipMapNearestFilter,
    ClampToEdgeWrapping,
    MirroredRepeatWrapping,
    LinearMipMapNearestFilter,
    NearestFilter
} from "../constants";
import {Events} from "../Events";

/**
 * Contains geometry and materials for a model in a {@link Viewer}.
 *
 * ## Overview
 *
 * * Located in {@link Scene.sceneModels}
 * * Contains {@link SceneObject}s in {@link Scene.sceneObjects}
 * * Can have a {@link DataModel} in {@link Data.dataModels}
 */
export interface SceneModel {

    /** Unique ID of this SceneModel.
     */
    readonly id: string;

    /**
     * The owner Scene.
     */
    readonly scene: Scene;

    /**
     * Manages events occurring on this SceneModel.
     */
    readonly events: Events;

    /**
     * The {@link SceneObject}s in this SceneModel.
     *
     * SceneObjects are keyed to {@link SceneObject.id}.
     */
    readonly sceneObjects: { [key: string]: SceneObject };

    /**
     * The axis-aligned World-space 3D boundary of this SceneModel.
     */
    readonly aabb: FloatArrayType;

    /**
     True once this SceneModel has been destroyed.

     Don't use this SceneModel if this is ````true````.
     */
    readonly destroyed: boolean;


    // constructor(cfg: {}): void;

    /**
     * Creates a SceneTransform within this SceneModel.
     *
     * @param cfg Transform configuration.
     * @param cfg.id ID for the transform, unique within this SceneModel.
     * @param cfg.parentTransformId ID of an optional parent transform in {@link SceneModel.transforms}.
     * @param cfg.matrix Modeling matrix for this transform.
     * @returns The new transform.
     */
    createTransform(cfg: {
        id: string,
        parentTransformId?: string,
        matrix: FloatArrayType,
    }): SceneTransform;

    /**
     * Creates a geometry within this SceneModel.
     *
     * * Geometries may then be reused by meshes created with {@link SceneModel.createMesh}.
     *
     * @param cfg - Geometry configuration.
     * @param cfg.id - ID for the geometry, unique within this SceneModel.
     * @param cfg.primitive - Primitive type; Accepted values are 'points', 'lines', 'triangles', 'solid' and 'surface'.
     * @param cfg.positions - Flat array of uncompressed floating point vertex positions.
     * @param cfg.origin - Optional geometry origin, relative to {@link SceneModel.origin}. When this is given, then every
     * mesh created with {@link SceneModel.createMesh} that uses this geometry will
     * be transformed relative to this origin.
     * @param cfg.positionsCompressed - Flat array of compressed integer vertex positions. Also requires positionsDecompressMatrix.
     * @param cfg.positionsDecompressMatrix - Matrix to decompress positionsCompressed.
     * @param cfg.normals - Flat array of floating point vertex normals.
     * @param cfg.normalsCompressed - Flat array of compressed integer vertex normals.
     * @param cfg.uvs - Flat array of floating point vertex UV coordinates.
     * @param cfg.uvsCompressed - Flat array of compressed integer vertex UV coordinates.
     * @param {Number[]} [cfg.uvsDecompressMatrix] A 3x3 matrix for decompressing ````uvsCompressed````.
     * @param cfg.colors - Flat array of floating point RGBA vertex colors.
     * @param cfg.colorsCompressed - Flat array of compressed integer RGBA vertex colors.
     * @param cfg.indices - Flat array of vertex connectivity indices for the geometry primitive type.
     * @param cfg.edgeIndices - Flat array of edge vertex indices.
     */
    createGeometry(cfg: {
        id: string,
        primitive: string,
        origin?: FloatArrayType,
        positions?: FloatArrayType,
        positionsCompressed?: Uint16Array,
        positionsDecompressMatrix?: FloatArrayType,
        normals?: FloatArrayType,
        normalsCompressed?: Uint8Array,
        uvs?: FloatArrayType,
        uvsCompressed?: FloatArrayType,
        uvsDecompressMatrix?: FloatArrayType,
        colors?: FloatArrayType,
        colorsCompressed?: FloatArrayType,
        indices?: IntArrayType,
        edgeIndices?: IntArrayType,
        edgeThreshold?: number
    }): void;

    /**
     * Creates a texture within this SceneModel.
     *
     * @param cfg Texture configuration.
     * @param cfg.id Unique ID for the texture within this SceneModel.
     * @param cfg.src  Image file for the texture.
     * @param cfg.buffers Transcoded texture data.
     * @param cfg.image HTML Image object to load into this texture. Overrides ````src```` and ````buffers````.
     * @param cfg.magFilter How the texture is sampled when a texel covers more than one pixel. Supported values are {@link LinearFilter} and {@link NearestFilter}.
     * @param cfg.minFilter How the texture is sampled when a texel covers less than one pixel. Supported values
     * are {@link LinearMipmapLinearFilter}, {@link LinearMipMapNearestFilter}, {@link NearestMipMapNearestFilter}, {@link NearestMipMapLinearFilter} and {@link LinearMipMapLinearFilter}.
     * @param  cfg.wrapS Wrap parameter for texture coordinate *S*. Supported values are {@link ClampToEdgeWrapping}, {@link MirroredRepeatWrapping} and {@link RepeatWrapping}.
     * @param cfg.wrapT Wrap parameter for texture coordinate *T*. Supported values are {@link ClampToEdgeWrapping}, {@link MirroredRepeatWrapping} and {@link RepeatWrapping}..
     * @param cfg.flipY Flips this Texture's source data along its vertical axis when ````true````.
     * @param  cfg.encoding Encoding format. Supported values are {@link LinearEncoding} and {@link sRGBEncoding}.
     * @param  cfg.preloadColor RGBA color to preload the texture with.
     */
    createTexture(cfg: {
        id: string,
        src?: string,
        buffers?: ArrayBuffer[],
        image?: HTMLImageElement,
        magFilter?: number,
        minFilter?: number,
        wrapS?: number,
        wrapT?: number,
        flipY?: boolean,
        encoding?: number,
        preloadColor?: FloatArrayType
    }): void;

    /**
     * Creates a texture set within this SceneModel.
     *
     * @param cfg
     * @param cfg.id - ID for the texture set, unique within this SceneModel.
     * @param cfg.colorTextureId ID of *RGBA* base color texture, with color in *RGB* and alpha in *A*.
     * @param cfg.metallicRoughnessTextureId ID of *RGBA* metal-roughness texture, with the metallic factor in *R*, and roughness factor in *G*.
     * @param cfg.normalsTextureId ID of *RGBA* normal map texture, with normal map vectors in *RGB*.
     * @param cfg.emissiveTextureId ID of *RGBA* emissive map texture, with emissive color in *RGB*.
     * @param cfg.occlusionTextureId ID of *RGBA* occlusion map texture, with occlusion factor in *R*.
     */
    createTextureSet(cfg: {
        id: string,
        colorTextureId?: string,
        metallicRoughnessTextureId?: string,
        occlusionTextureId?: string,
        normalsTextureId?: string,
        emissiveTextureId?: string
    }): void;

    /**
     * Creates a mesh within this SceneModel.
     *
     * * A mesh can either define its own geometry, or reuse a geometry created previously with {@link SceneModel.createGeometry}.
     * * A mesh can also be configured with modeling transforms to apply to the geometry.
     * * Each mesh can be aggregated into a {@link SceneObject} by {@link SceneModel.createSceneObject}. Each SceneMesh can belong to a maximum of one SceneObject.
     *
     * @param cfg - Mesh configuration.
     * @param cfg.id - ID for the mesh, unique within this SceneModel.
     * @param cfg.geometryId - ID of a geometry to use for this mesh. Assumes that the geometry was previously created
     * with {@link SceneModel.createGeometry}. If given, the geometry takes precedence over any other geometry parameters
     * given to this function.
     * @param cfg.textureSetId - ID of a texture set to use for this mesh. Assumes that the texture set was previously created
     * with {@link SceneModel.createTextureSet}.
     * @param cfg.primitive - Primitive type; Accepted values are 'points', 'lines', 'triangles', 'solid' and 'surface'.
     * @param cfg.positions - Flat array of uncompressed floating point vertex positions.
     * @param cfg.positionsCompressed - Flat array of compressed integer vertex positions. Also requires positionsDecompressMatrix.
     * @param cfg.positionsDecompressMatrix - Matrix to decompress positionsCompressed.
     * @param cfg.origin - Optional origin, relative to {@link SceneModel.origin}. When this is given,
     * then ````positions```` or ````positionsCompressed```` are assumed to be relative to this.
     * @param cfg.normals - Flat array of floating point vertex normals.
     * @param cfg.normalsCompressed - Flat array of compressed integer vertex normals.
     * @param cfg.uvs - Flat array of floating point vertex UV coordinates.
     * @param cfg.uvsCompressed - Flat array of compressed integer vertex UV coordinates.
     * @param cfg.uvsDecompressMatrix A 3x3 matrix for decompressing ````uvsCompressed````.
     * @param cfg.colors - Flat array of floating point RGBA vertex colors.
     * @param cfg.colorsCompressed - Flat array of compressed integer RGBA vertex colors.
     * @param cfg.indices - Flat array of vertex connectivity indices for the geometry primitive type.
     * @param cfg.edgeIndices - Flat array of edge vertex indices.
     * @param cfg.position - Local translation.
     * @param cfg.scale - Local scale.
     * @param cfg.rotation - Rotation of the mesh as Euler angles given in degrees, for each of the X, Y and Z axis.
     * @param cfg.quaternion - Rotation of the mesh, given as a quaternion.
     * @param cfg.matrix -  Mesh modelling transform matrix. Overrides the ````position````, ````scale```` and ````rotation```` parameters.
     */
    createMesh(cfg: {
        id?: string,
        textureSetId?: string,
        geometryId?: string,
        primitive?: string,
        color?: FloatArrayType,
        opacity?: number,
        metallic?: number,
        roughness?: number,
        origin?: FloatArrayType,
        rtcCenter?: FloatArrayType;
        positions?: FloatArrayType,
        positionsCompressed?: FloatArrayType,
        positionsDecompressMatrix?: FloatArrayType,
        normals?: FloatArrayType,
        normalsCompressed?: FloatArrayType,
        uvs?: FloatArrayType,
        uvsCompressed?: FloatArrayType,
        uvsDecompressMatrix?: FloatArrayType,
        colors?: FloatArrayType,
        colorsCompressed?: FloatArrayType,
        indices?: IntArrayType,
        edgeIndices?: IntArrayType,
        edgeThreshold?: number,
        position?: FloatArrayType,
        scale?: FloatArrayType,
        quaternion?: FloatArrayType,
        rotation?: FloatArrayType,
        matrix?: FloatArrayType
    }): void;

    /**
     * Creates a {@link SceneObject} within this SceneModel.
     *
     * * The SceneObject will aggregate meshes created previously with {@link SceneModel.createMesh}.
     * * The SceneObject will be registered by {@link SceneObject.id} in {@link SceneModel.sceneObjects}.
     * * Automagically gets a {@link ViewObject} in each {@link View} of the {@link Viewer}. The {@link ViewObject}s will also get destroyed automagically when this SceneObject is destroyed.
     *
     * @param cfg - SceneObject configuration.
     * @param cfg.id - ID for the SceneObject, unique within this SceneModel. The SceneObject is registered by this
     * ID in {@link SceneModel.sceneObjects}.
     * @param cfg.meshIds - IDs of the meshes to aggregate within this SceneObject. Assumes each mesh was created previously
     * with {@link createMesh}. Also assumes that each mesh has not already been aggregated by another SceneObject.
     * @param cfg.transformId - Optional ID of a {@link SceneTransform} created previously with {@link createTransform}.
     */
    createSceneObject(cfg: {
        id?: string,
        meshIds: string[],
        transformId?: string
    }): SceneObject;

    /**
     * Finalizes this SceneModel and prepares it for use.
     */
    finalize(): void;

    /**
     * Destroys this SceneModel.
     *
     * Causes {@link Scene} to fire a "sceneModelDestroyed" event.
     */
    destroy(): void;
}
