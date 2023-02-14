import type {Geometry} from "./Geometry";
import type {Texture} from "./Texture";
import type {TextureSet} from "./TextureSet";
import type {Mesh} from "./Mesh";
import type {SceneObject} from "./SceneObject";
import type {EventEmitter} from "./EventEmitter";
import type {TransformParams} from "./TransformParams";
import type {GeometryParams} from "./GeometryParams";
import type {GeometryCompressedParams} from "./GeometryCompressedParams";
import type {TextureParams} from "./TextureParams";
import type {TextureSetParams} from "./TextureSetParams";
import type {MeshParams} from "./MeshParams";
import type {ObjectParams} from "./ObjectParams";


/**
 * A buildable scene model representation, containing objects, meshes, geometries, materials and textures.
 *
 * See usage in:
 *
 * * [@xeokit/scratchmodel](/docs/modules/_xeokit_scratchmodel.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 * * [@xeokit/xkt](/docs/modules/_xeokit_xkt.html)
 */
export interface SceneModel {

    /**
     * The SceneModel's ID.
     */
    readonly id: string;

    /**
     * The Geometries in this SceneModel.
     */
    readonly geometries: { [key: string]: Geometry };

    /**
     * The Textures in this SceneModel.
     */
    readonly textures: { [key: string]: Texture };

    /**
     * TextureSets in this SceneModel.
     */
    readonly textureSets: { [key: string]: TextureSet };

    /**
     * Meshes in this SceneModel.
     */
    readonly meshes: { [key: string]: Mesh };

    /**
     * SceneObjects in this SceneModel.
     */
    readonly objects: { [key: string]: SceneObject };

    /**
     * The ID of the {@link @xeokit/viewer!ViewLayer | ViewLayer} this SceneModel appears in.
     */
    readonly viewLayerId?: string;

    /**
     * Indicates if this SceneModel has already been built.
     *
     * Set ````true```` by {@link @xeokit/core/components!SceneModel.build}.
     *
     * Don't create anything more in this SceneModel once it's built.
     */
    readonly built: boolean;

    /**
     * Indicates if this SceneModel has been destroyed.
     *
     * Set ````true```` by {@link @xeokit/core/components!SceneModel.destroy}.
     *
     * Don't create anything more in this ScratchModel once it's destroyed.
     */
    readonly destroyed: boolean;

    /**
     * Emits an event when this {@link @xeokit/core/components!SceneModel} has already been built.
     *
     * Triggered by {@link @xeokit/core/components!SceneModel.build}.
     *
     * Don't create anything more in this SceneModel once it's built.
     *
     * @event
     */
    readonly onBuilt: EventEmitter<SceneModel, null>;

    /**
     * Emits an event when this {@link @xeokit/core/components!SceneModel} has been destroyed.
     *
     * Triggered by {@link @xeokit/core/components!SceneModel.destroy}.
     *
     * Don't create anything more in this SceneModel once it's destroyed.
     *
     * @event
     */
    readonly onDestroyed: EventEmitter<SceneModel, null>;

    /**
     * Creates a new transform within this SceneModel.
     *
     * @param transformParams Transform creation parameters.
     * @throws {Error} If Buildable has already been built or destroyed.
     */
    createTransform(transformParams: TransformParams): void;

    /**
     * Creates a geometry within this SceneModel from non-compressed geometry parameters.
     *
     * ### Usage
     *
     * ````javascript
     * sceneModel.createGeometry({
     *      id: "myBoxGeometry",
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
     * @param geometryParams Non-compressed geometry creation parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createGeometry(geometryParams: GeometryParams): void;

    /**
     * Creates a geometry within this SceneModel, from pre-compressed geometry parameters.
     *
     * ````javascript
     * sceneModel.createGeometryCompressed({
     *      id: "myBoxGeometry",
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
     * @param geometryCompressedParams Compressed geometry creation parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): void;

    /**
     * Creates a texture in this SceneModel.
     *
     * ````javascript
     * sceneModel.createTexture({
     *      textureId: "myColorTexture",
     *      src: // Path to JPEG, PNG, KTX2,
     *      image: // HTMLImageElement,
     *      buffers: // ArrayBuffer[] containing KTX2 MIP levels
     *      preloadColor: [1,0,0,1],
     *      flipY: false,
     *      encoding: LinearEncoding, // @xeokit/core/constants
     *      magFilter: LinearFilter,
     *      minFilter: LinearFilter,
     *      wrapR: ClampToEdgeWrapping,
     *      wrapS: ClampToEdgeWrapping,
     *      wrapT: ClampToEdgeWrapping,
     * });
     * ````
     *
     * @param textureParams Texture creation parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createTexture(textureParams: TextureParams): void;

    /**
     * Creates a texture set in this SceneModel.
     *
     * ````javascript
     * sceneModel.createTextureSet({
     *      textureSetId: "myTextureSet",
     *      colorTextureId: "myColorTexture"
     * });
     * ````
     *
     * @param textureSetParams Texture set parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createTextureSet(textureSetParams: TextureSetParams): void;

    /**
     * Creates a mesh in this SceneModel.
     *
     * ````javascript
     * sceneModel.createMesh({
     *      meshId: "redLegMesh",
     *      id: "myBoxGeometry",
     *      textureSetId: "myTextureSet",
     *      position: [-4, -6, -4],
     *      scale: [1, 3, 1],
     *      rotation: [0, 0, 0],
     *      color: [1, 0.3, 0.3]
     * });
     * ````
     *
     * @param meshParams Mesh creation parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createMesh(meshParams: MeshParams): void;

    /**
     * Creates an object in this SceneModel.
     *
     * ````javascript
     *  viewerModel.createObject({
     *     objectId: "redLeg",
     *     meshIds: ["redLegMesh"]
     * });
     * ````
     *
     * @param objectParams Object creation parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createObject(objectParams: ObjectParams): void;

    /**
     * Builds this SceneModel.
     *
     * Sets {@link @xeokit/core/components!SceneModel.built} ````true````.
     *
     * Once built, you cannot add any more components to this SceneModel.
     *
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    build(): void;

    /**
     * Destroys this SceneModel.
     *
     * Sets {@link @xeokit/core/components!SceneModel.built} true.
     *
     @throws {Error} If SceneModel has already been destroyed.
     */
    destroy(): void;
}