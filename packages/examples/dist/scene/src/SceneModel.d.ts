import { Component, EventEmitter, SDKError } from "@xeokit/core";
import { Geometry } from "./Geometry";
import { SceneObject } from "./SceneObject";
import { TextureSet } from "./TextureSet";
import { Texture } from "./Texture";
import { Mesh } from "./Mesh";
import type { RendererModel } from "./RendererModel";
import type { TransformParams } from "./TransformParams";
import type { TextureSetParams } from "./TextureSetParams";
import type { GeometryParams } from "./GeometryParams";
import type { GeometryCompressedParams } from "./GeometryCompressedParams";
import type { MeshParams } from "./MeshParams";
import type { SceneObjectParams } from "./SceneObjectParams";
import type { TextureParams } from "./TextureParams";
import type { SceneModelParams } from "./SceneModelParams";
import type { Scene } from "./Scene";
import type { SceneModelStats } from "./SceneModelStats";
/**
 * xeokit Geometry and Materials Model.
 *
 * * A representation of a model's geometry and materials within a {@link Scene}.
 * * Contains {@link SceneObject | SceneObjects}, {@link Mesh | Meshes}, {@link Geometry | Geometries} and {@link Texture | Textures}.
 * * Compresses textures using [Basis](/docs/pages/GLOSSARY.html#basis)
 * * Compresses geometry using [bucketing](/docs/pages/GLOSSARY.html#geometry-bucketing) and [quantization](/docs/pages/GLOSSARY.html#geometry-quantization)
 * * Viewable in the Browser with {@link @xeokit/viewer!Viewer}
 * * Importable from various model file formats, using {@link @xeokit/gltf!loadGLTF}, {@link @xeokit/las!loadLAS}, {@link @xeokit/cityjson!loadCityJSON}, {@link @xeokit/xkt!loadXKT} (etc)
 * * Exportable to XKT format using {@link @xeokit/xkt!saveXKT}
 * * Programmatically buildable using builder methods
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export declare class SceneModel extends Component {
    #private;
    /**
     * The {@link Scene} that contains this SceneModel.
     */
    readonly scene: Scene;
    /**
     * Unique ID of this SceneModel.
     *
     * SceneModel are stored against this ID in {@link Scene.models}.
     */
    readonly id: string;
    /**
     * If we want to view this SceneModel with a {@link @xeokit/viewer}, an
     * optional ID of a {@link @xeokit/viewer!ViewLayer | ViewLayer} to view it in.
     */
    readonly layerId?: string;
    /**
     * Indicates if this SceneModel has already been built.
     *
     * * Set ````true```` by {@link SceneModel.build | SceneModel.build}.
     * * Subscribe to updates using {@link SceneModel.onBuilt | SceneModel.onBuilt} and {@link Scene.onModelCreated | Scene.onModelCreated}.
     * * Don't create anything more in this SceneModel once it's built.
     */
    built: boolean;
    /**
     * Indicates if this SceneModel has been destroyed.
     *
     * * Set ````true```` by {@link SceneModel.destroy | SceneModel.destroy}.
     * * Don't create anything more in this SceneModel once it's destroyed.
     */
    readonly destroyed: boolean;
    /**
     * The edge threshold for automatic [edge primitive generation](/docs/pages/GLOSSARY.html#geometry-edge-generation).
     */
    readonly edgeThreshold: number;
    /**
     * {@link @xeokit/scene!Geometry | Geometries} within this SceneModel, each mapped to {@link @xeokit/scene!Geometry.id | Geometry.id}.
     *
     * * Created by {@link SceneModel.createGeometry | SceneModel.createGeometry}.
     */
    readonly geometries: {
        [key: string]: Geometry;
    };
    /**
     * {@link Texture | Textures} within this SceneModel, each mapped to {@link Texture.id | Texture.id}.
     *
     * * Created by {@link SceneModel.createTexture | SceneModel.createTexture}.
     * * Compressed asynchronously in {@link SceneModel.build | SceneModel.build}.
     */
    readonly textures: {
        [key: string]: Texture;
    };
    /**
     * {@link TextureSet | TextureSets} within this SceneModel, each mapped to {@link TextureSet.id | TextureSet.id}.
     *
     * * Created by {@link SceneModel.createTextureSet | SceneModel.createTextureSet}.
     */
    readonly textureSets: {
        [key: string]: TextureSet;
    };
    /**
     * {@link Mesh | Meshes} within this SceneModel, each mapped to {@link Mesh.id | Mesh.id}.
     *
     * * Created by {@link SceneModel.createMesh | SceneModel.createMesh}.
     */
    readonly meshes: {
        [key: string]: Mesh;
    };
    /**
     * {@link SceneObject | SceneObjects} within this SceneModel, each mapped to {@link SceneObject.id | SceneObject.id}.
     *
     * * Created by {@link SceneModel.createObject | SceneModel.createObject}.
     */
    readonly objects: {
        [key: string]: SceneObject;
    };
    /**
     * The axis-aligned 3D World-space boundary of this SceneModel.
     *
     * * Created by {@link SceneModel.build | SceneModel.build}.
     */
    readonly aabb: Float64Array;
    /**
     * Emits an event when this {@link @xeokit/scene!SceneModel | SceneModel} has been built.
     *
     * * Triggered by {@link SceneModel.build | SceneModel.build}.
     *
     * @event onBuilt
     */
    readonly onBuilt: EventEmitter<SceneModel, null>;
    /**
     * Emits an event when this {@link @xeokit/scene!SceneModel | SceneModel} has been destroyed.
     *
     * * Triggered by {@link SceneModel.destroy | SceneModel.destroy}.
     *
     * @event
     */
    readonly onDestroyed: EventEmitter<SceneModel, null>;
    /**
     *  Internal interface through which a SceneModel can load property updates into a renderer.
     *
     * @internal
     */
    rendererModel: RendererModel | null;
    /**
     * Statistics on this SceneModel.
     */
    readonly stats: SceneModelStats;
    /**
     * @private
     */
    constructor(scene: Scene, sceneModelParams: SceneModelParams);
    /**
     * Adds components to this SceneModel.
     *
     * See {@link "@xeokit/scene"} for usage.
     *
     * @param sceneModelParams
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this SceneModel has already been built.
     * * If this SceneModel has already been destroyed.
     * * A duplicate component ({@link SceneObject}, {@link Mesh}, {@link Geometry}, {@link Texture} etc.) was already created within this SceneModel.
     */
    fromJSON(sceneModelParams: SceneModelParams): void | SDKError;
    /**
     * Creates a new {@link Transform} within this SceneModel.
     *
     * * Stores the new {@link Transform} in {@link SceneModel.transforms | SceneModel.transforms}.
     *
     * ### Usage
     *
     * ````javascript
     * const spinningTransform = sceneModel.createTransform({
     *      id: "spinningTransform",
     *      rotation: [0, 10, 0]
     * });
     *
     * const spinningTransformAgain = sceneModel.transforms["spinningTransform"];
     * ````
     *
     * See {@link "@xeokit/scene"} for more usage info.
     *
     * @param transformParams Transform creation parameters.
     * @returns *{@link Transform}*
     * * On success
     * @returns *{@link @xeokit/core!SDKError}*
     * * If SceneModel has already been built or destroyed.
     */
    createTransform(transformParams: TransformParams): void | SDKError;
    /**
     * Creates a new {@link Texture} within this SceneModel.
     *
     * * Stores the new {@link Texture} in {@link SceneModel.textures | SceneModel.textures}.
     * * Textures are compressed asynchronously by {@link SceneModel.build | SceneModel.build}.
     *
     * ### Usage
     *
     * ````javascript
     * const texture = sceneModel.createTexture({
     *      id: "myColorTexture",
     *      src: // Path to JPEG, PNG, KTX2,
     *      image: // HTMLImageElement,
     *      buffers: // ArrayBuffer[] containing KTX2 MIP levels
     *      preloadColor: [1,0,0,1],
     *      flipY: false,
     *      encoding: LinearEncoding, // @xeokit/constants
     *      magFilter: LinearFilter,
     *      minFilter: LinearFilter,
     *      wrapR: ClampToEdgeWrapping,
     *      wrapS: ClampToEdgeWrapping,
     *      wrapT: ClampToEdgeWrapping,
     * });
     *
     * const textureAgain = sceneModel.textures["myColorTexture"];
     * ````
     *
     * See {@link "@xeokit/scene"} for more usage info.
     *
     * @param textureParams - Texture creation parameters.
     * @returns *{@link Texture}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If SceneModel has already been built or destroyed.
     * * Invalid TextureParams were given.
     * * Texture with given ID already exists in this Scene.
     */
    createTexture(textureParams: TextureParams): Texture | SDKError;
    /**
     * Creates a new {@link TextureSet} within this SceneModel.
     *
     * * Stores the new {@link TextureSet} in {@link SceneModel.textureSets | SceneModel.textureSets}.
     *
     * ### Usage
     *
     * ````javascript
     * const textureSet = sceneModel.createTextureSet({
     *      id: "myTextureSet",
     *      colorTextureId: "myColorTexture"
     * });
     *
     * const textureSetAgain = sceneModel.textureSets["myTextureSet"];
     * ````
     *
     * See {@link "@xeokit/scene"} for more usage info.
     *
     * @param textureSetParams TextureSet creation parameters.
     *
     * @returns *{@link TextureSet}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If SceneModel has already been built or destroyed.
     * * Invalid TextureSetParams were given.
     * * TextureSet with given ID already exists in this SceneModel.
     * * One or more of the given Textures could not be found in this SceneModel.
     */
    createTextureSet(textureSetParams: TextureSetParams): TextureSet | SDKError;
    /**
     * Creates a new {@link @xeokit/scene!Geometry} within this SceneModel, from non-compressed geometry parameters.
     *
     * * Stores the new {@link Geometry} in {@link SceneModel.geometries | SceneModel.geometries}.
     *
     * ### Usage
     *
     * ````javascript
     * const boxGeometry = sceneModel.createGeometry({
     *      id: "boxGeometry",
     *      primitive: TrianglesPrimitive, // @xeokit/constants
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
     *
     * if (boxGeometry instanceof SDKError) {
     *     console.log(boxGeometry.message);
     * } else {
     *      const boxGeometryAgain = sceneModel.geometries["boxGeometry"];
     * }
     * ````
     *
     * See {@link "@xeokit/scene"} for more usage info.
     *
     * @param geometryParams Non-compressed geometry parameters.
     * @returns *{Geometry}*
     *  * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid GeometryParams were given.
     * * Geometry of given ID already exists in this SceneModel.
     * * Unsupported primitive type given.
     * * Mandatory vertex positions were not given. Vertex positions are mandatory for all primitive types.
     * * Mandatory indices were not given for primitive type that is not {@link PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
     * * Indices out of range of vertex positions.
     * * Indices out of range of vertex UVs.
     * * Mismatch between given quantities of vertex positions and UVs.
     */
    createGeometry(geometryParams: GeometryParams): Geometry | SDKError;
    /**
     * Creates a new {@link @xeokit/scene!Geometry} within this SceneModel, from pre-compressed geometry parameters.
     *
     * * Stores the new {@link Geometry} in {@link SceneModel.geometries | SceneModel.geometries}.
     * * Use {@link @xeokit/compression!compressGeometryParams} to pre-compress {@link @xeokit/scene!GeometryParams|GeometryParams} into {@link @xeokit/scene!GeometryCompressedParams|GeometryCompressedParams}.
     *
     * ### Usage
     *
     * ````javascript
     * const boxGeometry = sceneModel.createGeometryCompressed({
     *      id: "boxGeometry",
     *      primitive: TrianglesPrimitive, // @xeokit/constants
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
     * if (boxGeometry instanceof SDKError) {
     *     console.log(boxGeometry.message);
     * } else {
     *      const boxGeometryAgain = sceneModel.geometries["boxGeometry"];
     * }
     * ````
     *
     * See {@link "@xeokit/scene"} for more usage info.
     *
     * @param geometryCompressedParams Pre-compressed geometry parameters.
     * @returns *{@link Geometry}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid GeometryParams were given.
     * * Geometry of given ID already exists in this SceneModel.
     * * Unsupported primitive type given.
     * * Mandatory vertex positions were not given. Vertex positions are mandatory for all primitive types.
     * * Mandatory indices were not given for primitive type that is not {@link PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
     * * Indices out of range of vertex positions.
     * * Indices out of range of vertex UVs.
     * * Mismatch between given quantities of vertex positions and UVs.
     */
    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): Geometry | SDKError;
    /**
     * Creates a new {@link Mesh} within this SceneModel.
     *
     * * Stores the new {@link Mesh} in {@link SceneModel.meshes | SceneModel.meshes}.
     * * A {@link Mesh} can be owned by one {@link SceneObject}, which can own multiple {@link Mesh}es.
     *
     * ### Usage
     *
     * ````javascript
     * const redBoxMesh = sceneModel.createMesh({
     *      id: "redBoxMesh",
     *      geometryId: "boxGeometry",
     *      textureSetId: "myTextureSet",
     *      position: [-4, -6, -4],
     *      scale: [1, 3, 1],
     *      rotation: [0, 0, 0],
     *      color: [1, 0.3, 0.3]
     * });
     *
     * if (redBoxMesh instanceof SDKError) {
     *      console.log(redBoxMesh.message);
     * } else {
     *      const redBoxMeshAgain = sceneModel.meshes["redBoxMesh"];
     * }
     * ````
     *
     * See {@link "@xeokit/scene"} for more usage info.
     *
     * @param meshParams Pre-compressed mesh parameters.
     * @returns *{@link Mesh}*
     *  * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid MeshParams were given.
     * * Mesh of given ID already exists in this SceneModel.
     * * Specified Geometry could not be found in this SceneModel.
     * * Specified TextureSet could not be found in this SceneModel.
     */
    createMesh(meshParams: MeshParams): Mesh | SDKError;
    /**
     * Creates a new {@link SceneObject}.
     *
     * * Stores the new {@link SceneObject} in {@link SceneModel.objects | SceneModel.objects} and {@link Scene.objects | Scene.objects}.
     * * Fires an event via {@link Scene.onObjectCreated | Scene.onObjectCreated}.
     * * Each {@link Mesh} is allowed to belong to one SceneObject.
     * * SceneObject IDs must be unique within the SceneModel's {@link Scene}.
     *
     * ### Usage
     *
     * ````javascript
     * const redBoxObject = sceneModel.createObject({
     *     id: "redBoxObject",
     *     meshIds: ["redBoxMesh"]
     * });
     *
     * if (redBoxObject instanceof SDKError) {
     *      console.log(redBoxObject.message);
     * } else {
     *      const redBoxObjectAgain = sceneModel.objects["redBoxObject"];
     *      const redBoxObjectOnceMore = scene.objects["redBoxObject"];
     * }
     * ````
     *
     * See {@link "@xeokit/scene"} for more usage info.
     *
     * @param objectParams SceneObject parameters.
     * @returns *{@link SceneObject}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid ObjectParams were given.
     * * SceneObject of given ID already exists in this SceneModel's Scene. Note that SceneObject IDs must be unique within the Scene.
     * * No Meshes were specified.
     * * One or more of the specified Meshes already belong to another SceneObject in this SceneModel.
     * * Specified Meshes could not be found in this SceneModel.
     */
    createObject(objectParams: SceneObjectParams): SceneObject | SDKError;
    /**
     * Finalizes this SceneModel, readying it for use.
     *
     * * Fires an event via {@link SceneModel.onBuilt | SceneModel.onBuilt} and {@link Scene.onModelCreated | SceneModel.onCreated}, to indicate to subscribers that
     * the SceneModel is complete and ready to use.
     * * Sets {@link SceneModel.built | SceneModel.built} ````true````.
     * * You can only call this method once on a SceneModel.
     * * The SceneModel must have at least one {@link SceneObject}.
     * * Once built, no more components can be created in a SceneModel.
     *
     * ### Usage
     *
     * ````javascript
     * sceneMode.onBuilt.subscribe(()=>{
     *     // Our SceneModel is built and ready to use
     * });
     *
     * myScene.onModelCreated.subscribe((sceneModel)=>{
     *     // Another way to subscribe to SceneModel readiness
     * });
     *
     * mySceneModel.build().then((result) => { // Asynchronous (texture compression etc).
     *      if (result instanceof SDKError) {
     *          console.log(result.message);
     *      }  else {
     *          // Now we can do things with our SceneModel
     *      }
     * }).catch(sdkError) {// SDKError
     *     console.log(sdkError.message);
     * };
     * ````
     *
     * See {@link "@xeokit/scene"} for more usage info.
     *
     * @throws *{@link @xeokit/core!SDKError}*
     * * If SceneModel has already been built or destroyed.
     * * If no SceneObjects were created in this SceneModel.
     */
    build(): Promise<SceneModel>;
}
