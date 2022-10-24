import {Scene} from "./Scene";
import {FloatArrayType} from "../math/math";
import {SceneObject} from "./SceneObject";
import {Transform} from "../../webgl/WebGLSceneModel/lib/Transform";
import {Events} from "../Events";
import {SceneObjectParams} from "./SceneObjectParams";
import {MeshParams} from "./MeshParams";
import {TextureSetParams} from "./TextureSetParams";
import {TextureParams} from "./TextureParams";
import {TransformParams} from "../../webgl/WebGLSceneModel/lib/TransformParams";
import {GeometryParams} from "./GeometryParams";

/**
 * Contains geometry and materials for a model within a {@link Viewer}.
 *
 * * Contains {@link SceneObject}s
 * * Created by {@link Scene.createSceneModel}
 * * Stored in {@link Scene.sceneModels}
 * * May have a corresponding {@link DataModel}
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
     * List of the {@link SceneObject}s in this SceneModel.
     */
    readonly sceneObjectList: SceneObject[];

    /**
     * The axis-aligned World-space 3D boundary of this SceneModel.
     */
    readonly aabb: FloatArrayType;

    /**
     * The 3D World-space coordinate origin of this SceneModel.
     */
    readonly origin: FloatArrayType;

    /**
     * The 3D World-space transform matrix of this SceneModel.
     */
    readonly worldMatrix: FloatArrayType;

    /**
     * The 3D World-space normal transform matrix of this SceneModel.
     */
    readonly worldNormalMatrix: FloatArrayType;

    /**
     * Whether quality rendering is enabled for this SceneModel.
     *
     * Default is ````true````.
     */
     qualityRender: boolean;

    /**
     * True once this SceneModel has been destroyed.
     */
    readonly destroyed: boolean;

    /**
     * Creates a Transform within this SceneModel.
     *
     * @param params Transform configuration.
     * @returns The new transform.
     */
    createTransform(params: TransformParams): Transform;

    /**
     * Creates a geometry within this SceneModel.
     *
     * @param params Geometry configuration.
     */
    createGeometry(params: GeometryParams): void;

    /**
     * Creates a texture within this SceneModel.
     *
     * @param params Texture configuration.
     */
    createTexture(params: TextureParams): void;

    /**
     * Creates a texture set within this SceneModel.
     *
     * @param params Texture set configuration.
     */
    createTextureSet(params: TextureSetParams): void;

    /**
     * Creates a mesh within this SceneModel.
     *
     * @param params Mesh configuration.
     */
    createMesh(params: MeshParams): void;

    /**
     * Creates a {@link SceneObject} within this SceneModel.
     *
     * @param params SceneObject configuration.
     * @returns The new SceneObject
     * @see {@link DataModel.createDataObject}
     */
    createSceneObject(params: SceneObjectParams): SceneObject;

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
