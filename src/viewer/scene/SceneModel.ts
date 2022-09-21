import {Scene} from "./Scene";
import {FloatArrayType} from "../math/math";
import {SceneObject} from "./SceneObject";
import {Transform} from "./Transform";
import {Events} from "../Events";
import {SceneObjectCfg} from "./SceneObjectCfg";
import {MeshCfg} from "./MeshCfg";
import {TextureSetCfg} from "./TextureSetCfg";
import {TextureCfg} from "./TextureCfg";
import {TransformCfg} from "./TransformCfg";
import {GeometryCfg} from "./GeometryCfg";

/**
 * A model within a {@link Scene}.
 *
 * ## Overview
 *
 * * Created by {@link Scene.createSceneModel}
 * * Stored in {@link Scene.sceneModels}
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
     * Creates a Transform within this SceneModel.
     *
     * @param cfg Transform configuration.
     * @returns The new transform.
     */
    createTransform(cfg: TransformCfg): Transform;

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
     * @param cfg Mesh configuration.
     */
    createMesh(cfg: MeshCfg): void;

    /**
     * Creates a {@link SceneObject} within this SceneModel.
     *
     * @param cfg SceneObject configuration.
     * @returns The new SceneObject
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
