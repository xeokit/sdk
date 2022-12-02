import {Scene} from "./Scene";
import {SceneObject} from "./SceneObject";
import {Transform} from "./Transform";
import {Events} from "../Events";
import {SceneObjectParams} from "./SceneObjectParams";
import {MeshParams} from "./MeshParams";
import {TextureSetParams} from "./TextureSetParams";
import {TextureParams} from "./TextureParams";
import {TransformParams} from "./TransformParams";
import {GeometryParams} from "./GeometryParams";
import {GeometryCompressedParams} from "./GeometryCompressedParams";
import {FloatArrayParam} from "../math/index";

/**
 *  Buildable container of geometry and materials for a model.
 *
 *  * Created by factory method {@link Scene.createModel}
 *  * Has builder methods {@link SceneModel.createGeometry}, {@link SceneModel.createTexture}, {@link SceneModel.createObject} etc.
 *  * Contains {@link SceneObject | SceneObjects}
 *  * Stored in {@link Scene.models}
 *
 * ## Usage
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";*
 *
 * const myViewer = new Viewer({
 *    id: "myViewer"
 * });
 *
 * const mySceneModel = myViewer.scene.createModel({
 *    id: "myModel"
 * });
 *
 * mySceneModel.createGeometry({
 *    id: "myGeometry",
 *    primitive: constants.TrianglesPrimitive,
 *    positions: [...],
 *    indices: [...]
 *    //...
 * });
 *
 * mySceneModel.createMesh({
 *    id: "myMesh",
 *    geometryId: "myGeometry",
 *    //...
 * });
 *
 * mySceneModel.createObject({
 *    id: "myObject",
 *    meshIds: ["myMesh"],
 *    viewLayer: "main"
 *    //...
 * });
 *
 * myModel.finalize();
 * ````
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
     * The {@link SceneObject}s in this SceneModel, each mapped to {@link SceneObject.id}.
     */
    readonly objects: { [key: string]: SceneObject };

    /**
     * List of the {@link SceneObject}s in this SceneModel.
     */
    readonly objectList: SceneObject[];

    /**
     * The axis-aligned World-space 3D boundary of this SceneModel.
     */
    readonly aabb: FloatArrayParam;

    /**
     * The 3D World-space coordinate origin of this SceneModel.
     */
    readonly origin: FloatArrayParam;

    /**
     * The 3D World-space transform matrix of this SceneModel.
     */
    readonly worldMatrix: FloatArrayParam;

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
     * Creates a geometry within this SceneModel, from non-compressed geometry parameters.
     *
     * @param params Non-compressed geometry parameters.
     */
    createGeometry(params: GeometryParams): void;

    /**
     * Creates a geometry within this SceneModel, from pre-compressed geometry parameters.
     *
     * Use {@link compressGeometryParams} to pre-compress {@link GeometryParams} into {@link GeometryCompressedParams}.
     *
     * @param params Pre-compressed geometry parameters.
     */
    createGeometryCompressed(params: GeometryCompressedParams): void;

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
     * @see {@link DataModel.createObject}
     */
    createObject(params: SceneObjectParams): SceneObject;

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
