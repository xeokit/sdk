import {Scene} from "./Scene";
import * as math from "../math";
import {FloatArrayType} from "../math";
import {SceneObject} from "./SceneObject";
import {Component} from "../Component";

/**
 * Contains geometry and materials for a model in a {@link Viewer}.
 *
 * ## Overview
 *
 * * Belongs to a {@link Scene}
 * * Registered by {@link Component.id} in {@link Scene.sceneModels}
 * * Contains {@link SceneObject}s
 * * Provides builder methods to populate with SceneObjects
 * * May have a {@link MetaModel} in {@link MetaScene.metaModels}
 */
export abstract class SceneModel extends Component {

    /**
     * The owner Scene.
     */
    public readonly scene: Scene;

    /**
     * The {@link SceneObject}s in this Model.
     *
     * SceneObjects are keyed to {@link SceneObject.id}.
     */
    public readonly sceneObjects: { [key: string]: SceneObject };

    /**
     * List of the {@link SceneObject}s in this Model.
     */
    public readonly sceneObjectsList: SceneObject[];

    /**
     * The number of {@link SceneObject}s in this Model.
     */
    public numSceneObjects: number;

    /**
     * Creates a SceneModel.
     */
    protected constructor(scene: Scene,
                          cfg: {
                              id: string
                          }) {

        super(scene, cfg);

        this.scene = scene;
        this.sceneObjects = {};
        this.sceneObjectsList = [];

        scene.addSceneModel(this);
    }

    abstract createTexture(cfg: {
        id: string,
        data: any
    }): void;

    abstract createMaterial(cfg: {
        id: string,
        type:string,
        textureIds: string[],
        attributes: FloatArrayType
    }): void;

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
     * @param cfg.positionsCompressed - Flat array of compressed integer vertex positions. Also requires positionsDecodeMatrix.
     * @param cfg.positionsDecodeMatrix - Matrix to decompress positionsCompressed.
     * @param cfg.normals - Flat array of floating point vertex normals.
     * @param cfg.normalsCompressed - Flat array of compressed integer vertex normals.
     * @param cfg.uvs - Flat array of floating point vertex UV coordinates.
     * @param cfg.uvsCompressed - Flat array of compressed integer vertex UV coordinates.
     * @param cfg.colors - Flat array of floating point RGBA vertex colors.
     * @param cfg.colorsCompressed - Flat array of compressed integer RGBA vertex colors.
     * @param cfg.indices - Flat array of vertex connectivity indices for the geometry primitive type.
     * @param cfg.edgeIndices - Flat array of edge vertex indices.
     */
    abstract createGeometry(cfg: {
        id: string,
        primitive: string,
        origin?: math.FloatArrayType,
        positions?: math.FloatArrayType,
        positionsCompressed?: math.FloatArrayType,
        positionsDecodeMatrix?: math.FloatArrayType,
        normals?: math.FloatArrayType,
        normalsCompressed?: math.FloatArrayType,
        uvs?: math.FloatArrayType,
        uvsCompressed?: math.FloatArrayType,
        colors?: math.FloatArrayType,
        colorsCompressed?: math.FloatArrayType,
        indices?: number[],
        edgeIndices?: number[]
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
     * @param cfg.materialId - ID of a material to use for this mesh. Assumes that the material was previously created
     * with {@link SceneModel.createMaterial}.
     * @param cfg.primitive - Primitive type; Accepted values are 'points', 'lines', 'triangles', 'solid' and 'surface'.
     * @param cfg.positions - Flat array of uncompressed floating point vertex positions.
     * @param cfg.positionsCompressed - Flat array of compressed integer vertex positions. Also requires positionsDecodeMatrix.
     * @param cfg.positionsDecodeMatrix - Matrix to decompress positionsCompressed.
     * @param cfg.origin - Optional origin, relative to {@link SceneModel.origin}. When this is given,
     * then ````positions```` or ````positionsCompressed```` are assumed to be relative to this.
     * @param cfg.normals - Flat array of floating point vertex normals.
     * @param cfg.normalsCompressed - Flat array of compressed integer vertex normals.
     * @param cfg.uvs - Flat array of floating point vertex UV coordinates.
     * @param cfg.uvsCompressed - Flat array of compressed integer vertex UV coordinates.
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
    abstract createMesh(cfg: {
        id?: string,
        // nodeId?: string,
        geometryId?: string,
        materialId?: string,
        primitive?: string,
        origin?: math.FloatArrayType,
        positions?: math.FloatArrayType,
        positionsCompressed?: math.FloatArrayType,
        positionsDecompressMatrix?: math.FloatArrayType,
        normals?: math.FloatArrayType,
        normalsCompressed?: math.FloatArrayType,
        uvs?: math.FloatArrayType,
        uvsCompressed?: math.FloatArrayType,
        colors?: math.FloatArrayType,
        colorsCompressed?: math.FloatArrayType,
        indices?: number[],
        edgeIndices?: number[],
        position?: math.FloatArrayType,
        scale?: math.FloatArrayType,
        quaternion?: math.FloatArrayType,
        rotation?: math.FloatArrayType,
        matrix?: math.FloatArrayType
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
     */
    abstract createSceneObject(cfg: { id?: string, meshIds: string[] }): SceneObject;

    /**
     * @protected
     */
    addSceneObject(object: SceneObject): void {
        if (this.sceneObjects[object.id]) {
            return;
        }
        this.sceneObjects[object.id] = object;
        this.sceneObjectsList.push(object);
    }

    /**
     * Finalizes this SceneModel and prepares it for use.
     */
    abstract finalize(): void;

    /**
     * Destroys this SceneModel.
     */
    destroy() {
        if (this.destroyed) {
            return;
        }
        for (let i = 0, len = this.sceneObjectsList.length; i < len; i++) {
            const object = this.sceneObjectsList[i];
            object.destroy();
        }
        this.scene.removeSceneModel(this);
        this.scene.aabbDirty = true;
        super.destroy();
    }
}
