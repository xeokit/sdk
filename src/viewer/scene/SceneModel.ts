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
     * The 3D World-space coordinate origin of this SceneModel.
     */
    readonly origin: FloatArrayType;

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
     * @param cfg Geometry configuration.
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
     * @param cfg Texture set configuration.
     */
    createTextureSet(cfg: TextureSetCfg): void;

    /**
     * Creates a mesh within this SceneModel.
     *
     * * A mesh can either define its own geometry, or reuse a geometry created previously with {@link SceneModel.createGeometry}.
     * * A mesh can also be configured with modeling transforms to apply to the geometry.
     * * Each mesh can be aggregated into a {@link SceneObject} by {@link SceneModel.createSceneObject}. Each SceneMesh can belong to a maximum of one SceneObject.
     *
     * @param cfg Mesh configuration.
     */
    createMesh(cfg: MeshCfg): void;

    /**
     * Creates a {@link SceneObject} within this SceneModel.
     *
     * * The SceneObject will aggregate meshes created previously with {@link SceneModel.createMesh}.
     * * The SceneObject will be registered by {@link SceneObject.id} in {@link SceneModel.sceneObjects}.
     * * Automagically gets a {@link ViewObject} in each {@link View} of the {@link Viewer}. The {@link ViewObject}s will also get destroyed automagically when this SceneObject is destroyed.
     *
     * @param cfg SceneObject configuration.
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
