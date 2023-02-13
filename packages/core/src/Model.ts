import type {Geometry} from "./Geometry";
import type {Texture} from "./Texture";
import type {TextureSet} from "./TextureSet";
import type {Mesh} from "./Mesh";
import type {XKTObject} from "./XKTObject";
import type {EventEmitter} from "./EventEmitter";
import type {TransformParams} from "./TransformParams";
import type {GeometryParams} from "./GeometryParams";
import type {GeometryCompressedParams} from "./GeometryCompressedParams";
import type {TextureParams} from "./TextureParams";
import type {TextureSetParams} from "./TextureSetParams";
import type {MeshParams} from "./MeshParams";
import type {ObjectParams} from "./ObjectParams";


/**
 * A model representation.
 */
export interface Model {

    /**
     * The Model's ID.
     */
    readonly id: string;

    /**
     * The geometries in this model.
     */
    readonly geometries: { [key: string]: Geometry };

    /**
     * The textures in this model.
     */
    readonly textures: { [key: string]: Texture };

    /**
     * Texture sets in this model.
     */
    readonly textureSets: { [key: string]: TextureSet };

    /**
     * Meshes in this model.
     */
    readonly meshes: { [key: string]: Mesh };

    /**
     * Objects in this model.
     */
    readonly objects: { [key: string]: XKTObject };

    /**
     * Indicates if this Model has already been built.
     *
     * Set ````true```` by {@link @xeokit/core/components!Model.build}.
     *
     * Don't create anything more in this Model once it's built.
     */
    readonly built: boolean;

    /**
     * Indicates if this Model has been destroyed.
     *
     * Set ````true```` by {@link @xeokit/core/components!Model.destroy}.
     *
     * Don't create anything more in this ScratchModel once it's destroyed.
     */
    readonly destroyed: boolean;

    /**
     * Emits an event when this {@link @xeokit/core/components!Model} has already been built.
     *
     * Triggered by {@link @xeokit/core/components!Model.build}.
     *
     * Don't create anything more in this Model once it's built.
     *
     * @event
     */
    readonly onBuilt: EventEmitter<Model, null>;

    /**
     * Emits an event when this {@link @xeokit/core/components!Model} has been destroyed.
     *
     * Triggered by {@link @xeokit/core/components!Model.destroy}.
     *
     * Don't create anything more in this Model once it's destroyed.
     *
     * @event
     */
    readonly onDestroyed: EventEmitter<Model, null>;

    /**
     * Creates a new transform within this Model.
     *
     * @param transformParams Transform creation parameters.
     * @throws {Error} If Buildable has already been built or destroyed.
     */
    createTransform(transformParams: TransformParams): void;

    /**
     * Creates a geometry within this Model from non-compressed geometry parameters.
     *
     * ### Usage
     *
     * ````javascript
     * myModel.createGeometry({
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
     * @throws {Error} If Model has already been built or destroyed.
     */
    createGeometry(geometryParams: GeometryParams): void;

    /**
     * Creates a geometry within this Model, from pre-compressed geometry parameters.
     *
     * ````javascript
     * myModel.createGeometryCompressed({
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
     * @throws {Error} If Model has already been built or destroyed.
     */
    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): void;

    /**
     * Creates a texture in this Model.
     *
     * ````javascript
     * myModel.createTexture({
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
     * @throws {Error} If Model has already been built or destroyed.
     */
    createTexture(textureParams: TextureParams): void;

    /**
     * Creates a texture set in this Model.
     *
     * ````javascript
     * myModel.createTextureSet({
     *      textureSetId: "myTextureSet",
     *      colorTextureId: "myColorTexture"
     * });
     * ````
     *
     * @param textureSetParams Texture set parameters.
     * @throws {Error} If Model has already been built or destroyed.
     */
    createTextureSet(textureSetParams: TextureSetParams): void;

    /**
     * Creates a mesh in this Model.
     *
     * ````javascript
     * myModel.createMesh({
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
     * @throws {Error} If Model has already been built or destroyed.
     */
    createMesh(meshParams: MeshParams): void;

    /**
     * Creates an object in this Model.
     *
     * ````javascript
     *  viewerModel.createObject({
     *     objectId: "redLeg",
     *     meshIds: ["redLegMesh"]
     * });
     * ````
     *
     * @param objectParams Object creation parameters.
     * @throws {Error} If Model has already been built or destroyed.
     */
    createObject(objectParams: ObjectParams): void;

    /**
     * Builds this Model.
     *
     * Sets {@link @xeokit/core/components!Model.built} ````true````.
     *
     * Once built, you cannot add any more components to this Model.
     *
     * @throws {Error} If Model has already been built or destroyed.
     */
    build(): void;

    /**
     * The 3D axis-aligned World-space boundary of this model.
     *
     * Only available after calling {@link build | Model.build}.
     */
    get aabb(): Float64Array;

    /**
     * Destroys this Model.
     *
     * Sets {@link @xeokit/core/components!Model.built} true.
     *
     @throws {Error} If Model has already been destroyed.
     */
    destroy(): void;
}