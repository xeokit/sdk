import type {Scene} from "./Scene";
import type {SceneObject} from "./SceneObject";
import type {Transform} from "./Transform";
import type {Events} from "../Events";
import type {SceneObjectParams} from "./SceneObjectParams";
import type {MeshParams} from "./MeshParams";
import type {TextureSetParams} from "./TextureSetParams";
import type {TextureParams} from "./TextureParams";
import type {TransformParams} from "./TransformParams";
import type {GeometryParams} from "./GeometryParams";
import type {GeometryCompressedParams} from "./GeometryCompressedParams";
import type {FloatArrayParam} from "../math/index";

/**
 *  A buildable representation of geometry and materials for a model within a {@link Viewer}.
 *
 *  ## Summary
 *
 * * Created by {@link Scene.createModel}
 * * Contained in {@link Scene.models}
 * * Contains {@link SceneObject|SceneObjects} in {@link SceneModel.objects}
 * * Use {@link SceneModel.createObject} to create {@link SceneObject|SceneObjects}
 * * Use {@link SceneModel.createMesh} to create meshes
 * * Use {@link SceneModel.createGeometry} to create geometries
 * * Use {@link SceneModel.createTexture} to create textures
 * * Provides the boundary of all contained {@link SceneObject|SceneObjects} in {@link SceneModel.aabb}
 * * Creates geometry from {@link GeometryCompressedParams|compressed} and {@link GeometryParams|uncompressed} formats
 * * Supports KTX compressed textures
 * * A {@link ViewObject} will automatically exist in each {@link View} for every {@link SceneObject} that exists
 *
 * ## Overview
 *
 * ## Examples
 *
 * ### Example 1. SceneModel with uncompressed geometry
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
 *
 * const myViewer = new Viewer({
 *    id: "myViewer"
 * });
 *
 * myViewer.createView({
 *     id: "myView",
 *     canvasId: "myCanvas"
 * });
 *
 * const mySceneModel = myViewer.scene.createModel({
 *    id: "myModel"
 * });
 *
 * mySceneModel.createGeometry({
 *     id: "myBoxGeometry",
 *     primitive: constants.TrianglesPrimitive,
 *     positions: [
 *         1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
 *         1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1,
 *         1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1,
 *         -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1,
 *         -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
 *         1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
 *     ],
 *     indices: [
 *         0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
 *         16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
 *     ]
 * });
 *
 * mySceneModel.createMesh({
 *    id: "myMesh",
 *    geometryId: "myGeometry"
 * });
 *
 * mySceneModel.createObject({
 *    id: "myObject",
 *    meshIds: ["myMesh"]
 * });
 *
 * mySceneModel.finalize();
 * ````
 *
 * ### Example 2. SceneModel with pre-compressed geometry
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
 *
 * const myViewer = new Viewer({
 *    id: "myViewer"
 * });
 *
 * myViewer.createView({
 *     id: "myView",
 *     canvasId: "myCanvas"
 * });
 *
 * const mySceneModel = myViewer.scene.createModel({
 *    id: "myModel"
 * });
 *
 * mySceneModel.createGeometryCompressed({
 *      id: "myBoxGeometry",
 *      primitive: constants.TrianglesPrimitive,
 *      positionsDecompressMatrix: [
 *          0.00003052270125906143, 0, 0, 0,
 *          0, 0.00003052270125906143, 0, 0,
 *          0, 0, 0.00003052270125906143, 0,
 *          -1, -1, -1, 1
 *      ],
 *      geometryBuckets: [
 *          {
 *              positionsCompressed: [
 *                  65525, 65525, 65525, 0, 65525, 65525, 0, 0,
 *                  65525, 65525, 0, 65525, 65525, 0, 0, 65525,
 *                  65525, 0, 0, 65525, 0, 0, 0, 0
 *              ],
 *              indices: [
 *                  0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
 *                  0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
 *                  4, 7, 6, 4, 6, 5
 *              ]
 *          }
 *      ]
 * });
 *
 * mySceneModel.createMesh({
 *    id: "myMesh",
 *    geometryId: "myGeometry"
 * });
 *
 * mySceneModel.createObject({
 *    id: "myObject",
 *    meshIds: ["myMesh"]
 * });
 *
 * mySceneModel.finalize();
 * ````
 *
 * ### Textures
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
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
 *     id: "myBoxGeometry",
 *     primitive: constants.TrianglesPrimitive,
 *     positions: [
 *         1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
 *         1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1,
 *         1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1,
 *         -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1,
 *         -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
 *         1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
 *     ],
 *     indices: [
 *         0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
 *         16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
 *     ]
 * });
 *
 * mySceneGeometry.createTexture({
 *      id: "myColorTexture",
 *      src: "myColorTexture.jpeg",
 *      preloadColor: [1,0,0,1],
 *      encoding: constants.LinearEncoding,
 *      flipY: false,
 *      magFilter: constants.LinearFiler,
 *      minFilter: constants.LinearFiler,
 *      wrapR: constants.ClampToEdgeWrapping,
 *      wrapS: constants.ClampToEdgeWrapping,
 *      wrapT: constants.ClampToEdgeWrapping,
 * });
 *
 * mySceneModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture"
 * });
 *
 * mySceneModel.createMesh({
 *    id: "myMesh",
 *    geometryId: "myGeometry",
 *    textureSetId: "myTextureSet",
 * });
 *
 * mySceneModel.createObject({
 *    id: "myObject",
 *    meshIds: ["myMesh"]
 * });
 *
 * mySceneModel.finalize();
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
     * The {@link SceneObject|SceneObjects} in this SceneModel, each mapped to {@link SceneObject.id}.
     */
    readonly objects: { [key: string]: SceneObject };

    /**
     * List of the {@link SceneObject|SceneObjects} in this SceneModel.
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
    createTransform(params: TransformParams): Transform|null;

    /**
     * Creates a geometry within this SceneModel, from non-compressed geometry parameters.
     *
     * @param params Non-compressed geometry parameters.
     *
     * ### Usage
     *
     * ````javascript
     * mySceneModel.createGeometry({
     *      id: "myBoxGeometry",
     *      primitive: constants.TrianglesPrimitive,
     *      positions: [
     *          1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, // v0-v1-v2-v3 front
     *          1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, // v0-v3-v4-v1 right
     *          1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, // v0-v1-v6-v1 top
     *          -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, // v1-v6-v7-v2 left
     *          -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,// v7-v4-v3-v2 bottom
     *          1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1 // v4-v7-v6-v1 back
     *      ],
     *      indices: [
     *          0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
     *          16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
     *      ]
     *  });
     * ````
     */
    createGeometry(params: GeometryParams): void;

    /**
     * Creates a geometry within this SceneModel, from pre-compressed geometry parameters.
     *
     * Use {@link compressGeometryParams} to pre-compress {@link GeometryParams} into {@link GeometryCompressedParams}.
     *
     * ### Usage
     *
     * ````javascript
     * mySceneModel.createGeometryCompressed({
     *      id: "myBoxGeometry",
     *      primitive: constants.TrianglesPrimitive,
     *      positionsDecompressMatrix: [
     *          0.00003052270125906143, 0, 0, 0,
     *          0, 0.00003052270125906143, 0, 0,
     *          0, 0, 0.00003052270125906143, 0,
     *          -1, -1, -1, 1
     *      ],
     *      geometryBuckets: [
     *          {
     *              positionsCompressed: [
     *                  65525, 65525, 65525, 0, 65525, 65525, 0, 0,
     *                  65525, 65525, 0, 65525, 65525, 0, 0, 65525,
     *                  65525, 0, 0, 65525, 0, 0, 0, 0
     *              ],
     *              indices: [
     *                  0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
     *                  0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
     *                  4, 7, 6, 4, 6, 5
     *              ]
     *          }
     *      ]
     * });
     * ````
     *
     * @param params Pre-compressed geometry parameters.
     */
    createGeometryCompressed(params: GeometryCompressedParams): void;

    /**
     * Creates a texture within this SceneModel.
     *
     * ### Usage
     *
     * ````javascript
     * mySceneMode.createTexture({
     *      id: "myColorTexture",
     *      src: // Path to JPEG, PNG, KTX2,
     *      image: // HTMLImageElement,
     *      buffers: // ArrayBuffer[] containing KTX2 MIP levels
     *      preloadColor: [1,0,0,1],
     *      encoding: constants.LinearEncoding,
     *      flipY: false,
     *      magFilter: constants.LinearFiler,
     *      minFilter: constants.LinearFiler,
     *      wrapR: constants.ClampToEdgeWrapping,
     *      wrapS: constants.ClampToEdgeWrapping,
     *      wrapT: constants.ClampToEdgeWrapping,
     * });
     *
     * @param params Texture configuration.
     */
    createTexture(params: TextureParams): void;

    /**
     * Creates a texture set within this SceneModel.
     *
     * ### Usage
     *
     * ````javascript
     * mySceneModel.createTextureSet({
     *      id: "myTextureSet",
     *      colorTextureId: "myColorTexture"
     * });
     * ````
     *
     * @param params Texture set configuration.
     */
    createTextureSet(params: TextureSetParams): void;

    /**
     * Creates a mesh within this SceneModel.
     *
     * ### Usage
     *
     * ````javascript
     * mySceneModel.createMesh({
     *      id: "redLegMesh",
     *      geometryId: "myBoxGeometry",
     *      textureSetId: "myTextureSet",
     *      position: [-4, -6, -4],
     *      scale: [1, 3, 1],
     *      rotation: [0, 0, 0],
     *      color: [1, 0.3, 0.3]
     * });
     * ````
     *
     * @param params Mesh configuration.
     */
    createMesh(params: MeshParams): void;

    /**
     * Creates a {@link SceneObject} within this SceneModel.
     *
     * ### Usage
     *
     * ````javascript
     * const mySceneObject = sceneModel.createObject({
     *     id: "redLeg",
     *     meshIds: ["redLegMesh"]
     * });
     * ````
     *
     * @param params SceneObject configuration.
     * @returns The new SceneObject
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
