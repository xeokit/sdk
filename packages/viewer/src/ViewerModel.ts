import {FloatArrayParam} from "@xeokit/math/math";
import {
    EventEmitter,
    Geometry,
    GeometryCompressedParams,
    GeometryParams,
    Mesh,
    MeshParams,
    Model,
    ObjectParams,
    Texture,
    TextureParams,
    TextureSet,
    TextureSetParams,
    TransformParams
} from "@xeokit/core/components";

import type {ViewerObject} from "./ViewerObject";
import {Viewer} from "./Viewer";

/**
 * A model representation within a {@link @xeokit/viewer!Viewer}.
 *
 * See {@link @xeokit/viewer} for usage.
 *
 * ## Summary
 *
 * * Stored in {@link Viewer.models | Viewer.models}
 * * Created with {@link Viewer.createModel | Viewer.createModel}
 * * Contains {@link ViewerObject | ViewerObjects}
 * * Viewer automatically represents each {@link ViewerObject} with a corresponding {@link ViewObject} in each {@link @xeokit/viewer!View}
 */
export interface ViewerModel extends Model {

    /** Unique ID of this ViewerModel.
     *
     * Find the ViewerModel mapped to this ID in {@link Viewer.models}.
     */
    readonly id: string;

    /**
     * Indicates if this ViewerModel has already been built.
     *
     * Set ````true```` by {@link ViewerModel.build}.
     *
     * Don't create anything more in this ViewerModel once it's built.
     */
    readonly built: boolean;

    /**
     * Indicates if this ViewerModel has been destroyed.
     *
     * Set ````true```` by {@link ViewerModel.destroy}.
     *
     * Don't create anything more in this ScratchModel once it's destroyed.
     */
    readonly destroyed: boolean;

    /**
     * The owner Viewer.
     */
    readonly viewer: Viewer;

    /**
     * TODO
     */
    readonly readable: boolean;

    /**
     * The {@link @xeokit/core/components!Geometry|Geometries} in this model.
     */
    readonly geometries: { [key: string]: Geometry };

    /**
     * The {@link Texture|Textures} in this model.
     */
    readonly textures: { [key: string]: Texture };

    /**
     * {@link TextureSet|TextureSets} in this model.
     */
    readonly textureSets: { [key: string]: TextureSet };

    /**
     * {@link Mesh|Meshes} in this model
     */
    readonly meshes: { [key: string]: Mesh };

    /**
     * The {@link ViewerObject|ViewerObjects} in this ViewerModel, each mapped to {@link ViewerObject.id}.
     */
    readonly objects: { [key: string]: ViewerObject };

    /**
     * The axis-aligned World-space 3D boundary of this ViewerModel.
     */
    readonly aabb: FloatArrayParam;

    /**
     * The 3D World-space coordinate origin of this ViewerModel.
     */
    readonly origin: FloatArrayParam;

    /**
     * The 3D World-space transform matrix of this ViewerModel.
     */
    readonly worldMatrix: FloatArrayParam;

    /**
     * Whether quality rendering is enabled for this ViewerModel.
     *
     * Default is ````true````.
     */
    qualityRender: boolean;

    /**
     * Emits an event when the {@link @xeokit/viewer!ViewerModel | ViewerModel} has already been built.
     *
     * @event
     */
    readonly onBuilt: EventEmitter<ViewerModel, null>;

    /**
     * Emits an event when the {@link @xeokit/viewer!ViewerModel | ViewerModel} has been destroyed.
     *
     * @event
     */
    readonly onDestroyed: EventEmitter<ViewerModel, null>;

    /**
     * Creates a Transform within this ViewerModel.
     *
     * @param transformParams Transform parameters.
     * @throws {Error} If ViewerModel has already been built or destroyed.
     */
    createTransform(transformParams: TransformParams): void;

    /**
     * Creates a geometry within this ViewerModel, from non-compressed geometry parameters.
     *
     * ### Usage
     *
     * ````javascript
     * myViewerModel.createGeometry({
     *      geometryId: "myBoxGeometry",
     *      primitive: TrianglesPrimitive, // @xeokit/core/constants
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
     *
     * @param geometryParams Non-compressed geometry parameters.
     * @throws {Error} If ViewerModel has already been built or destroyed.
     */
    createGeometry(geometryParams: GeometryParams): void;

    /**
     * Creates a geometry within this ViewerModel, from pre-compressed geometry parameters.
     *
     * Use {@link @xeokit/compression/compressGeometryParams} to pre-compress {@link @xeokit/core/components!GeometryParams|GeometryParams} into {@link @xeokit/core/components!GeometryCompressedParams|GeometryCompressedParams}.
     *
     * ### Usage
     *
     * ````javascript
     * myViewerModel.createGeometryCompressed({
     *      geometryId: "myBoxGeometry",
     *      primitive: TrianglesPrimitive, // @xeokit/core/constants
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
     * @param geometryCompressedParams Pre-compressed geometry parameters.
     * @throws {Error} If ViewerModel has already been built or destroyed.
     */
    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): void;

    /**
     * Creates a texture within this ViewerModel.
     *
     * ### Usage
     *
     * ````javascript
     * mySceneMode.createTexture({
     *      textureId: "myColorTexture",
     *      src: // Path to JPEG, PNG, KTX2,
     *      image: // HTMLImageElement,
     *      buffers: // ArrayBuffer[] containing KTX2 MIP levels
     *      preloadColor: [1,0,0,1],
     *      encoding: constants.LinearEncoding,
     *      flipY: false,
     *      magFilter: constants.LinearFilter,
     *      minFilter: constants.LinearFilter,
     *      wrapR: constants.ClampToEdgeWrapping,
     *      wrapS: constants.ClampToEdgeWrapping,
     *      wrapT: constants.ClampToEdgeWrapping,
     * });
     * ````
     *
     * @param textureParams Texture configuration.
     * @throws {Error} If ViewerModel has already been built or destroyed.
     */
    createTexture(textureParams: TextureParams): void;

    /**
     * Creates a texture set within this ViewerModel.
     *
     * ### Usage
     *
     * ````javascript
     * myViewerModel.createTextureSet({
     *      textureSetId: "myTextureSet",
     *      colorTextureId: "myColorTexture"
     * });
     * ````
     *
     * @param params Texture set configuration.
     * @throws {Error} If ViewerModel has already been built or destroyed.
     */
    createTextureSet(params: TextureSetParams): void;

    /**
     * Creates a mesh within this ViewerModel.
     *
     * ### Usage
     *
     * ````javascript
     * myViewerModel.createMesh({
     *      meshId: "redLegMesh",
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
     * @throws {Error} If ViewerModel has already been built or destroyed.
     */
    createMesh(params: MeshParams): void;

    /**
     * Creates a {@link ViewerObject} within this ViewerModel.
     *
     * The ViewerObject is then registered in {@link Viewer.objects} by {@link ViewerObject.id}.
     *
     * ### Usage
     *
     * ````javascript
     * viewerModel.createObject({
     *     objectId: "redLeg",
     *     meshIds: ["redLegMesh"]
     * });
     *
     * const myViewerObject = myViewer.objects["redLeg"];
     * ````
     *
     * @param params ViewerObject configuration.
     * @throws {Error} If ViewerModel has already been built or destroyed.
     */
    createObject(params: ObjectParams): void;

    /**
     * Builds this ViewerModel.
     *
     * Sets {@link ViewerModel.built} ````true````.
     *
     * Once built, you cannot add any more components to this ViewerModel.
     *
     * @throws {Error} If ViewerModel has already been built or destroyed.
     */
    build(): void;

    /**
     * Destroys this ViewerModel.
     *
     * Sets {@link ViewerModel.built} true.
     *
     * @throws {Error} If ViewerModel has already been destroyed.
     */
    destroy(): void;
}
