import {Scene} from "./Scene";
import {FloatArrayType} from "../math/math";
import {SceneObject} from "./SceneObject";
import {SceneTransform} from "./SceneTransform";
import {Events} from "../Events";
import {SceneObjectCfg} from "./SceneObjectCfg";
import {MeshCfg} from "./MeshCfg";
import {TextureSetCfg} from "./TextureSetCfg";
import {TextureCfg} from "./TextureCfg";
import {SceneTransformCfg} from "./SceneTransformCfg";
import {GeometryCfg} from "./GeometryCfg";

/**
 * A model within a {@link Scene}.
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
     */
    readonly sceneObjects: { [key: string]: SceneObject };

    /**
     * The axis-aligned World-space 3D boundary of this SceneModel.
     */
    readonly aabb: FloatArrayType;

    /**
     * True once this SceneModel has been destroyed.
     */
    readonly destroyed: boolean;

    /**
     * Creates a SceneTransform within this SceneModel.
     *
     * @param cfg Transform configuration.
     * @returns The new transform.
     */
    createTransform(cfg: SceneTransformCfg): SceneTransform;

    /**
     * Creates a geometry within this SceneModel.
     *
     * @param cfg - Geometry configuration.
     */
    createGeometry(cfg: GeometryCfg): void;

    /**
     * Creates a texture within this SceneModel.
     *
     * @param cfg Texture configuration.
     */
    createTexture(cfg: TextureCfg): void;

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
    createTextureSet(cfg: TextureSetCfg): void;

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
    createMesh(cfg: MeshCfg): void;

    /**
     * Creates a {@link SceneObject} within this SceneModel.
     *
     * * The SceneObject will aggregate meshes created previously with {@link SceneModel.createMesh}.
     * * The SceneObject will be registered by {@link SceneObject.id} in {@link SceneModel.sceneObjects}.
     * * Automagically gets a {@link ViewObject} in each {@link View} of the {@link Viewer}. The {@link ViewObject}s will also get destroyed automagically when this SceneObject is destroyed.
     *
     * @param cfg - SceneObject configuration.
     */
    createSceneObject(cfg: SceneObjectCfg): SceneObject;

    /**
     * Finalizes this SceneModel and prepares it for use.
     *
     * Fires a "finalized" event.
     */
    finalize(): void;

    /**
     * Destroys this SceneModel.
     *
     * Causes {@link Scene} to fire a "sceneModelDestroyed" event.
     */
    destroy(): void;
}
