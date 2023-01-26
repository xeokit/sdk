import { Component } from '../Component';
import type { WebViewer } from "../WebViewer";
import type { ViewerObject } from "./ViewerObject";
import type { ViewerModel } from "./ViewerModel";
import type { ViewerModelParams } from "./ViewerModelParams";
import { Tiles } from "./Tiles";
import { EventEmitter } from "./../EventEmitter";
/**
 * Contains the geometric representations of the models in a {@link WebViewer}.
 *
 * ## Features
 *
 * * Multiple models
 * * Compressed, double-precision geometry
 * * Triangle, line and point primitives
 * * KTX2 compressed textures
 * * Transform hierarchies
 * * Moveable objects
 * * Object boundary tracking
 * * Physically-based materials
 *
 * ## Quickstart
 *
 * * Located at {@link WebViewer.scene}
 * * Create {@link ViewerModel|ViewerModels} with {@link Scene.createModel}
 * * Create {@link ViewerObject|ViewerObjects} with {@link ViewerModel.createObject}
 * * Create reusable geometries with {@link ViewerModel.createGeometry}
 * * Create reusable textures with {@link ViewerModel.createTexture} and {@link ViewerModel.createTextureSet}
 * * Create transform hierarchies with {@link ViewerModel.createTransform}
 * * Track object boundaries with {@link Scene.aabb}, {@link ViewerModel.aabb} and {@link ViewerObject.aabb}
 * * When built, be sure to finalize each ViewerModel with {@link ViewerModel.build}
 * * When no longer needed, be sure to destroy each ViewerModel with {@link ViewerModel.destroy}
 *
 * <br>
 *
 * ## Examples
 *
 * ### Example 1. Creating a ViewerModel from Uncompressed GeometryImpl
 *
 * ````javascript
 * import {WebViewer, constants} from "@xeokit/webviewer";
 *
 * const myViewer = new WebViewer({
 *    id: "myViewer"
 * });
 *
 * myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView"
 * });
 *
 * myViewer.scene.onModelCreated.subscribe((scene, viewerModel)=>{
 *      console.log(`ViewerModel ${viewerModel.id} created`);
 * });
 *
 * myViewer.scene.onModelDestroyed.subscribe((scene, viewerModel)=>{
 *      console.log(`ViewerModel ${viewerModel.id} destroyed`);
 * });
 *
 * const myViewerModel = myViewer.scene.createModel({
 *    id: "myModel"
 * });
 *
 * myViewerModel.createGeometry({
 *     id: "myBoxGeometry",
 *     primitive: constants.TrianglesPrimitive,
 *     positions: [
 *         1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
 *     ],
 *     indices: [
 *         0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
 *     ]
 * });
 *
 * myViewerModel.createMesh({
 *    id: "myMesh",
 *    geometryId: "myGeometry"
 * });
 *
 * myViewerModel.createObject({
 *    id: "myObject",
 *    meshIds: ["myMesh"]
 * });
 *
 * myViewerModel.build();
 * ````
 *
 * ### Example 2. Creating a ViewerModel from Pre-Compressed GeometryImpl
 *
 * ````javascript
 * import {WebViewer, constants} from "@xeokit/webviewer";
 *
 * const myViewer = new WebViewer({
 *    id: "myViewer"
 * });
 *
 * myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView"
 * });
 *
 * const myViewerModel = myViewer.scene.createModel({
 *    id: "myModel"
 * });
 *
 * myViewerModel.createGeometryCompressed({
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
 *                  65525, 65525, 65525, 0, 65525, 65525, 0, 0, 65525, 65525, 0, 65525, 65525, 0, 0, 65525, 65525, 0, 0, 65525, 0, 0, 0, 0
 *              ],
 *              indices: [
 *                  0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2, 4, 7, 6, 4, 6, 5
 *              ]
 *          }
 *      ]
 * });
 *
 * myViewerModel.createMesh({
 *    id: "myMesh",
 *    geometryId: "myGeometry"
 * });
 *
 * myViewerModel.createObject({
 *    id: "myObject",
 *    meshIds: ["myMesh"]
 * });
 *
 * myViewerModel.build();
 * ````
 *
 * ### Example 3. Creating a ViewerModel with a JPEG Texture
 *
 * ````javascript
 * import {WebViewer, constants} from "@xeokit/webviewer";
 *
 * const myViewer = new WebViewer({
 *    id: "myViewer"
 * });
 *
 * const myViewerModel = myViewer.scene.createModel({
 *    id: "myModel"
 * });
 *
 * myViewerModel.createGeometry({
 *     id: "myBoxGeometry",
 *     primitive: constants.TrianglesPrimitive,
 *     positions: [
 *         1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
 *     ],
 *     indices: [
 *         0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
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
 * myViewerModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture"
 * });
 *
 * myViewerModel.createMesh({
 *    id: "myMesh",
 *    geometryId: "myGeometry",
 *    textureSetId: "myTextureSet",
 * });
 *
 * myViewerModel.createObject({
 *    id: "myObject",
 *    meshIds: ["myMesh"]
 * });
 *
 * myViewerModel.build();
 * ````
 */
export declare class Scene extends Component {
    #private;
    /**
     * The {@link WebViewer} this Scene belongs to.
     */
    readonly viewer: WebViewer;
    /**
     * The {@link Tiles} in this Scene.
     */
    readonly tiles: Tiles;
    /**
     * The {@link ViewerModel|ViewerModels} in this Scene.
     */
    readonly models: {
        [key: string]: ViewerModel;
    };
    /**
     * The {@link ViewerObject|ViewerObjects} in this Scene.
     */
    readonly objects: {
        [key: string]: ViewerObject;
    };
    /**
     * Emits an event each time a {@link ViewerModel} is created.
     *
     * {@link Scene.aabb} and {@link Scene.center} may have updated values after this event.
     *
     * @event
     */
    readonly onModelCreated: EventEmitter<Scene, ViewerModel>;
    /**
     * Emits an event each time a {@link ViewerModel} is destroyed.
     *
     * {@link Scene.aabb} and {@link Scene.center} may have updated values after this event.
     *
     * @event
     */
    readonly onModelDestroyed: EventEmitter<Scene, ViewerModel>;
    /**
     * @private
     */
    constructor(viewer: WebViewer, params?: {});
    /**
     * Gets the World-space 3D center of this Scene.
     */
    get center(): Float64Array;
    /**
     * Gets the World-space axis-aligned 3D boundary (AABB) of this Scene.
     *
     * The AABB encompases the boundaries of all {@link ViewerModel} s currently in {@link Scene.models}, and  is
     * represented by a six-element Float64Array containing the min/max extents of the axis-aligned volume, ie. ````[xmin, ymin,zmin,xmax,ymax, zmax]````.
     *
     * When the Scene has no content, the boundary will be an inverted shape, ie. ````[-100,-100,-100,100,100,100]````.
     */
    get aabb(): Float64Array;
    /**
     * Creates a new {@link ViewerModel} within this Scene.
     *
     * The ViewerModel represents a new model within the Scene and provides an interface through which
     * we can then build geometry and materials within it.
     *
     * When we've finished building our ViewerModel, we then call {@link ViewerModel.build}, which causes it to
     * immediately begin rendering within all the {@link View|Views} we created previously with {@link WebViewer.createView}.
     *
     * As that happens, each {@link View} automatically gets a {@link ViewObject} for each of the ViewerModel's {@link ViewerObject|ViewerObjects}, to
     * independently represent that ViewerObject's visual state in that View.
     *
     * When we've finished with the ViewerModel, we destroy it using {@link ViewerModel.destroy}. That will automatically remove its
     * ViewObjects from all our existing Views.
     *
     * ### Usage
     *
     * ````javascript
     * const myViewerModel = myViewer.scene.createModel({
     *    id: "myModel"
     * });
     * ````
     *
     * @param params ViewerModel configuration
     */
    createModel(params: ViewerModelParams): ViewerModel | undefined;
    /**
     * Destroys all {@link ViewerModel|ViewerModels} in this Scene.
     *
     * This invalidates all ViewerModels created previously with {@link Scene.createModel}.
     */
    clear(): void;
    /**
     * @private
     */
    setAABBDirty(): void;
    /**
     * @private
     */
    destroy(): void;
}
