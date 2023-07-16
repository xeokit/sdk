// import {KTX2BasisWriter} from "@loaders.gl/textures";
// import {ImageLoader} from '@loaders.gl/images';
import {EventDispatcher} from "strongly-typed-events";
import {Component, EventEmitter, SDKError} from "@xeokit/core";
import {LinesPrimitive, PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "@xeokit/constants";
import {createAABB3} from "@xeokit/boundaries";

import {Geometry} from "./Geometry";
import {SceneObject} from "./SceneObject";
import {TextureSet} from "./TextureSet";
import {Texture} from "./Texture";
import {Mesh} from "./Mesh";
import type {RendererSceneModel} from "./RendererSceneModel";
import type {TransformParams} from "./TransformParams";
import type {TextureSetParams} from "./TextureSetParams";
import type {GeometryParams} from "./GeometryParams";
import type {GeometryCompressedParams} from "./GeometryCompressedParams";
import type {MeshParams} from "./MeshParams";
import type {SceneObjectParams} from "./SceneObjectParams";
import type {TextureParams} from "./TextureParams";
import {compressGeometryParams} from "./compressGeometryParams";
//import {encode, load} from "@loaders.gl/core";
import type {SceneModelParams} from "./SceneModelParams";
import type {Scene} from "./Scene";
import type {SceneModelStats} from "./SceneModelStats";

// XKT texture types

const COLOR_TEXTURE = 0;
const METALLIC_ROUGHNESS_TEXTURE = 1;
const NORMALS_TEXTURE = 2;
const EMISSIVE_TEXTURE = 3;
const OCCLUSION_TEXTURE = 4;

// KTX2 encoding options for each texture type

const TEXTURE_ENCODING_OPTIONS: {
    [key: string]: any
} = {}

TEXTURE_ENCODING_OPTIONS[COLOR_TEXTURE] = {
    useSRGB: true,
    qualityLevel: 50,
    encodeUASTC: true,
    mipmaps: true
};

TEXTURE_ENCODING_OPTIONS[EMISSIVE_TEXTURE] = {
    useSRGB: true,
    encodeUASTC: true,
    qualityLevel: 10,
    mipmaps: false
};

TEXTURE_ENCODING_OPTIONS[METALLIC_ROUGHNESS_TEXTURE] = {
    useSRGB: false,
    encodeUASTC: true,
    qualityLevel: 50,
    mipmaps: true // Needed for GGX roughness shading
};

TEXTURE_ENCODING_OPTIONS[NORMALS_TEXTURE] = {
    useSRGB: false,
    encodeUASTC: true,
    qualityLevel: 10,
    mipmaps: false
};

TEXTURE_ENCODING_OPTIONS[OCCLUSION_TEXTURE] = {
    useSRGB: false,
    encodeUASTC: true,
    qualityLevel: 10,
    mipmaps: false
};

/**
 * xeokit Geometry and Materials Model.
 *
 * * A representation of a model's geometry and materials within a {@link @xeokit/scene!Scene}.
 * * Contains {@link @xeokit/scene!SceneObject | SceneObjects}, {@link @xeokit/scene!Mesh | Meshes}, {@link @xeokit/scene!Geometry | Geometries} and {@link @xeokit/scene!Texture | Textures}.
 * * Compresses textures using [Basis](/docs/pages/GLOSSARY.html#basis)
 * * Compresses geometry using [bucketing](/docs/pages/GLOSSARY.html#geometry-bucketing) and [quantization](/docs/pages/GLOSSARY.html#geometry-quantization)
 * * Viewable in the Browser with {@link @xeokit/viewer!Viewer}
 * * Importable from various model file formats, using {@link @xeokit/gltf!loadGLTF}, {@link @xeokit/las!loadLAS}, {@link @xeokit/cityjson!loadCityJSON}, {@link @xeokit/xkt!loadXKT} (etc)
 * * Exportable to [XKT](/docs/pages/GLOSSARY.html#xkt) format using {@link @xeokit/xkt!saveXKT}
 * * Programmatically buildable using builder methods
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export class SceneModel extends Component {

    /**
     * The {@link @xeokit/scene!Scene} that contains this SceneModel.
     */
    public readonly scene: Scene;

    /**
     * Unique ID of this SceneModel.
     *
     * SceneModel are stored against this ID in {@link @xeokit/scene!Scene.models | Scene.models}.
     */
    declare public readonly id: string;

    /**
     * If we want to view this SceneModel with a {@link @xeokit/viewer!Viewer}, an
     * optional ID of a {@link @xeokit/viewer!ViewLayer | ViewLayer} to view it in.
     */
    public readonly layerId?: string;

    /**
     * Indicates if this SceneModel has already been built.
     *
     * * Set ````true```` by {@link @xeokit/scene!SceneModel.build | SceneModel.build}.
     * * Subscribe to updates using {@link @xeokit/scene!SceneModel.onBuilt | SceneModel.onBuilt}
     * and {@link @xeokit/scene!Scene.onModelCreated | Scene.onModelCreated}.
     * * Don't create anything more in this SceneModel once it's built.
     */
    public built: boolean;

    /**
     * Indicates if this SceneModel has been destroyed.
     *
     * * Set ````true```` by {@link @xeokit/scene!SceneModel.destroy | SceneModel.destroy}.
     * * Don't create anything more in this SceneModel once it's destroyed.
     */
    declare readonly destroyed: boolean;

    /**
     * The edge threshold for automatic [edge primitive generation](/docs/pages/GLOSSARY.html#geometry-edge-generation).
     */
    public readonly edgeThreshold: number;

    /**
     * {@link @xeokit/scene!Geometry | Geometries} within this SceneModel, each mapped to {@link @xeokit/scene!Geometry.id | Geometry.id}.
     *
     * * Created by {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry}.
     */
    public readonly geometries: { [key: string]: Geometry };

    /**
     * {@link @xeokit/scene!Texture | Textures} within this SceneModel, each mapped to {@link @xeokit/scene!Texture.id | Texture.id}.
     *
     * * Created by {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture}.
     * * Compressed asynchronously in {@link @xeokit/scene!SceneModel.build | SceneModel.build}.
     */
    public readonly textures: { [key: string]: Texture };

    /**
     * {@link @xeokit/scene!TextureSet | TextureSets} within this SceneModel, each mapped to {@link @xeokit/scene!TextureSet.id | TextureSet.id}.
     *
     * * Created by {@link @xeokit/scene!SceneModel.createTextureSet | SceneModel.createTextureSet}.
     */
    public readonly textureSets: { [key: string]: TextureSet };

    /**
     * {@link @xeokit/scene!Mesh | Meshes} within this SceneModel, each mapped to {@link @xeokit/scene!Mesh.id | Mesh.id}.
     *
     * * Created by {@link @xeokit/scene!SceneModel.createMesh | SceneModel.createMesh}.
     */
    public readonly meshes: { [key: string]: Mesh };

    /**
     * {@link @xeokit/scene!SceneObject | SceneObjects} within this SceneModel, each mapped to {@link @xeokit/scene!SceneObject.id | SceneObject.id}.
     *
     * * Created by {@link @xeokit/scene!SceneModel.createObject | SceneModel.createObject}.
     */
    readonly objects: { [key: string]: SceneObject };

    /**
     * The axis-aligned 3D World-space boundary of this SceneModel.
     *
     * * Created by {@link @xeokit/scene!SceneModel.build | SceneModel.build}.
     */
    public readonly aabb: Float64Array;

    /**
     * Emits an event when this {@link @xeokit/scene!SceneModel | SceneModel} has been built.
     *
     * * Triggered by {@link @xeokit/scene!SceneModel.build | SceneModel.build}.
     *
     * @event onBuilt
     */
    public readonly onBuilt: EventEmitter<SceneModel, null>;

    /**
     * Emits an event when this {@link @xeokit/scene!SceneModel | SceneModel} has been destroyed.
     *
     * * Triggered by {@link @xeokit/scene!SceneModel.destroy | SceneModel.destroy}.
     *
     * @event onDestroyed
     */
    declare public readonly onDestroyed: EventEmitter<SceneModel, null>;

    /**
     *  Internal interface through which a SceneModel can load updated content into a renderer.
     *
     * @internal
     */
    public rendererSceneModel: RendererSceneModel | null;

    /**
     * Statistics on this SceneModel.
     */
    public readonly stats: SceneModelStats;

    #texturesList: Texture[];
    #numObjects: number;
    #meshUsedByObject: { [key: string]: boolean };

    /**
     * @private
     */
    constructor(scene: Scene, sceneModelParams: SceneModelParams) {
        super(scene, {
            id: sceneModelParams.id
        });

        this.scene = scene;

        this.onBuilt = new EventEmitter(new EventDispatcher<SceneModel, null>());
        this.onDestroyed = new EventEmitter(new EventDispatcher<SceneModel, null>());

        this.#numObjects = 0;
        this.#meshUsedByObject = {};

        this.id = sceneModelParams.id || "default";
        this.layerId = sceneModelParams.layerId;
        this.edgeThreshold = 10;
        this.geometries = {};
        this.textures = {};
        this.#texturesList = [];
        this.textureSets = {};
        this.meshes = {};
        this.objects = {};
        this.aabb = createAABB3();
        this.built = false;
        this.rendererSceneModel = null;

        this.stats = {
            numGeometries: 0,
            numLines: 0,
            numMeshes: 0,
            numObjects: 0,
            numPoints: 0,
            numTextureSets: 0,
            numTextures: 0,
            numTriangles: 0,
            numVertices: 0,
            textureBytes: 0
        };

        this.fromJSON(sceneModelParams);
    }

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
     * * A duplicate component ({@link @xeokit/scene!SceneObject}, {@link @xeokit/scene!Mesh},
     * {@link @xeokit/scene!Geometry}, {@link @xeokit/scene!Texture} etc.) was already created within this SceneModel.
     */
    fromJSON(sceneModelParams: SceneModelParams): void | SDKError {
        if (this.destroyed) {
            return new SDKError("Failed to add components to SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to add components to SceneModel - SceneModel already built");
        }
        if (sceneModelParams.geometries) {
            for (let i = 0, len = sceneModelParams.geometries.length; i < len; i++) {
                this.createGeometry(sceneModelParams.geometries[i]);
            }
        }
        if (sceneModelParams.textures) {
            for (let i = 0, len = sceneModelParams.textures.length; i < len; i++) {
                this.createTexture(sceneModelParams.textures[i]);
            }
        }
        if (sceneModelParams.textureSets) {
            for (let i = 0, len = sceneModelParams.textureSets.length; i < len; i++) {
                this.createTextureSet(sceneModelParams.textureSets[i]);
            }
        }
        if (sceneModelParams.meshes) {
            for (let i = 0, len = sceneModelParams.meshes.length; i < len; i++) {
                this.createMesh(sceneModelParams.meshes[i]);
            }
        }
        if (sceneModelParams.objects) {
            for (let i = 0, len = sceneModelParams.objects.length; i < len; i++) {
                this.createObject(sceneModelParams.objects[i]);
            }
        }
    }

    /**
     * Creates a new {@link Transform} within this SceneModel.
     *
     * * Stores the new {@link Transform} in {@link @xeokit/scene!SceneModel.transforms | SceneModel.transforms}.
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
    createTransform(transformParams: TransformParams): void | SDKError {
        if (this.destroyed) {
            return new SDKError("Failed to create Transform in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create Transform in SceneModel - SceneModel already built");
        }
        //...
    }

    /**
     * Creates a new {@link @xeokit/scene!Texture} within this SceneModel.
     *
     * * Stores the new {@link @xeokit/scene!Texture} in {@link @xeokit/scene!SceneModel.textures | SceneModel.textures}.
     * * Textures are compressed asynchronously by {@link @xeokit/scene!SceneModel.build | SceneModel.build}.
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
     * @returns *{@link @xeokit/scene!Texture}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If SceneModel has already been built or destroyed.
     * * Invalid TextureParams were given.
     * * Texture with given ID already exists in this Scene.
     */
    createTexture(textureParams: TextureParams): Texture | SDKError {
        if (this.destroyed) {
            return new SDKError("Failed to create Texture in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create Texture in SceneModel - SceneModel already built");
        }
        if (!textureParams.imageData && !textureParams.src && !textureParams.buffers) {
            return new SDKError("Failed to create Texture in SceneModel - Parameter expected: textureParams.imageData, textureParams.src or textureParams.buffers");
        }
        if (this.textures[textureParams.id]) {
            return new SDKError(`Failed to create Texture in SceneModel - Texture already exists with this ID: ${textureParams.id}`);
        }
        if (textureParams.src) {
            const fileExt = textureParams.src.split('.').pop();
            // if (fileExt !== "jpg" && fileExt !== "jpeg" && fileExt !== "png") {
            //     console.error(`Model does not support image files with extension '${fileExt}' - won't create texture '${textureParams.id}`);
            //     return;
            // }
        }
        if (textureParams.imageData) {
            this.stats.textureBytes += (textureParams.imageData.width * textureParams.imageData.height * 4); // Guessing
        }
        const texture = new Texture(textureParams);
        this.textures[textureParams.id] = texture;
        this.#texturesList.push(texture);
        this.stats.numTextures++;
        return texture;
    }

    /**
     * Creates a new {@link @xeokit/scene!TextureSet} within this SceneModel.
     *
     * * Stores the new {@link @xeokit/scene!TextureSet} in {@link @xeokit/scene!SceneModel.textureSets | SceneModel.textureSets}.
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
     * @returns *{@link @xeokit/scene!TextureSet}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If SceneModel has already been built or destroyed.
     * * Invalid TextureSetParams were given.
     * * TextureSet with given ID already exists in this SceneModel.
     * * One or more of the given Textures could not be found in this SceneModel.
     */
    createTextureSet(textureSetParams: TextureSetParams): TextureSet | SDKError {
        if (this.destroyed) {
            return new SDKError("Failed to create TextureSet in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create TextureSet in SceneModel - SceneModel already built");
        }
        if (this.textureSets[textureSetParams.id]) {
            return new SDKError(`Failed to create TextureSet in SceneModel - TextureSet already exists with this ID: ${textureSetParams.id}`);
        }
        let colorTexture;
        if (textureSetParams.colorTextureId !== undefined && textureSetParams.colorTextureId !== null) {
            colorTexture = this.textures[textureSetParams.colorTextureId];
            if (!colorTexture) {
                return new SDKError(`Failed to create TextureSet in SceneModel - Texture not found: ${textureSetParams.colorTextureId} - ensure that you create it first with createTexture()`);
            }
            colorTexture.channel = COLOR_TEXTURE;
        }
        let metallicRoughnessTexture;
        if (textureSetParams.metallicRoughnessTextureId !== undefined && textureSetParams.metallicRoughnessTextureId !== null) {
            metallicRoughnessTexture = this.textures[textureSetParams.metallicRoughnessTextureId];
            if (!metallicRoughnessTexture) {
                return new SDKError(`Failed to create TextureSet in SceneModel - Texture not found: ${textureSetParams.metallicRoughnessTextureId} - ensure that you create it first with createTexture()`);
            }
            metallicRoughnessTexture.channel = METALLIC_ROUGHNESS_TEXTURE;
        }
        let normalsTexture;
        if (textureSetParams.normalsTextureId !== undefined && textureSetParams.normalsTextureId !== null) {
            normalsTexture = this.textures[textureSetParams.normalsTextureId];
            if (!normalsTexture) {
                return new SDKError(`Failed to create TextureSet in SceneModel - Texture not found: ${textureSetParams.normalsTextureId} - ensure that you create it first with createTexture()`);
            }
            normalsTexture.channel = NORMALS_TEXTURE;
        }
        let emissiveTexture;
        if (textureSetParams.emissiveTextureId !== undefined && textureSetParams.emissiveTextureId !== null) {
            emissiveTexture = this.textures[textureSetParams.emissiveTextureId];
            if (!emissiveTexture) {
                return new SDKError(`Failed to create TextureSet in SceneModel - Texture not found: ${textureSetParams.emissiveTextureId} - ensure that you create it first with createTexture()`);
            }
            emissiveTexture.channel = EMISSIVE_TEXTURE;
        }
        let occlusionTexture;
        if (textureSetParams.occlusionTextureId !== undefined && textureSetParams.occlusionTextureId !== null) {
            occlusionTexture = this.textures[textureSetParams.occlusionTextureId];
            if (!occlusionTexture) {
                return new SDKError(`Failed to create TextureSet in SceneModel - Texture not found: ${textureSetParams.occlusionTextureId} - ensure that you create it first with createTexture()`);
            }
            occlusionTexture.channel = OCCLUSION_TEXTURE;
        }
        const textureSet = new TextureSet(textureSetParams, {
            emissiveTexture,
            occlusionTexture,
            metallicRoughnessTexture,
            colorTexture
        });
        this.textureSets[textureSetParams.id] = textureSet;
        this.stats.numTextureSets++;
        return textureSet;
    }

    /**
     * Creates a new {@link @xeokit/scene!Geometry} within this SceneModel, from non-compressed geometry parameters.
     *
     * * Stores the new {@link @xeokit/scene!Geometry} in {@link @xeokit/scene!SceneModel.geometries | SceneModel.geometries}.
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
     * * Mandatory indices were not given for primitive type that is not {@link @xeokit/constants!PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
     * * Indices out of range of vertex positions.
     * * Indices out of range of vertex UVs.
     * * Mismatch between given quantities of vertex positions and UVs.
     */
    createGeometry(geometryParams: GeometryParams): Geometry | SDKError {
        if (this.destroyed) {
            return new SDKError("Failed to create Geometry in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create Geometry in SceneModel - SceneModel already built");
        }
        if (!geometryParams) {
            return new SDKError("Failed to create Geometry in SceneModel - Parameters expected: geometryParams");
        }
        if (geometryParams.id === null || geometryParams.id === undefined) {
            return new SDKError("Failed to create Geometry in SceneModel - Parameter expected: geometryParams.id");
        }
        const geometryId = geometryParams.id;
        if (this.geometries[geometryId]) {
            return new SDKError(`Failed to create Geometry in SceneModel - Geometry with this ID already created: ${geometryId}`);
        }
        const primitive = geometryParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            return new SDKError(`Failed to create Geometry in SceneModel - Unsupported value for geometryParams.primitive: '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
        }
        if (!geometryParams.positions) {
            return new SDKError("Failed to create Geometry in SceneModel - Param expected: geometryParams.positions");
        }
        if (!geometryParams.indices && primitive !== PointsPrimitive) {
            return new SDKError(`Failed to create Geometry in SceneModel - Param expected: geometryParams.indices (required for primitive type)`);
        }
        if (geometryParams.uvs) {
            if (geometryParams.uvs.length / 2 !== geometryParams.positions.length / 3) {
                return new SDKError("Failed to create Geometry in SceneModel - mismatch between given quantities of vertex positions and UVs");
            }
        }
        if (geometryParams.indices) {
            const lastPositionsIdx = geometryParams.positions.length / 3;
            for (let i = 0, len = geometryParams.indices.length; i < len; i++) {
                const idx = geometryParams.indices[i];
                if (idx < 0 || idx >= lastPositionsIdx) {
                    return new SDKError("Failed to create Geometry in SceneModel - indices out of range of vertex positions");
                }
                if (geometryParams.uvs) {
                    const lastUVsIdx = geometryParams.uvs.length / 2;
                    if (idx < 0 || idx >= lastUVsIdx) {
                        return new SDKError("Failed to create Geometry in SceneModel - indices out of range of vertex UVs");
                    }
                }
            }
        }
        const geometry = new Geometry(<GeometryCompressedParams>compressGeometryParams(geometryParams));
        this.geometries[geometryId] = geometry;
        this.stats.numGeometries++;
        if (geometryParams.indices) {
            if (geometry.primitive === TrianglesPrimitive) {
                this.stats.numTriangles += geometryParams.indices.length / 3;
            } else if (geometry.primitive === LinesPrimitive) {
                this.stats.numLines += geometryParams.indices.length / 2;
            }
        } else if (geometry.primitive === PointsPrimitive) {
            this.stats.numPoints += geometryParams.positions.length / 3;
        }
        this.stats.numVertices += geometryParams.positions.length / 3;
        return geometry;
    }

    /**
     * Creates a new {@link @xeokit/scene!Geometry} within this SceneModel, from pre-compressed geometry parameters.
     *
     * * Stores the new {@link @xeokit/scene!Geometry} in {@link @xeokit/scene!SceneModel.geometries | SceneModel.geometries}.
     * * Use {@link @xeokit/scene!compressGeometryParams} to pre-compress {@link @xeokit/scene!GeometryParams | GeometryParams}
     * into {@link @xeokit/scene!GeometryCompressedParams | GeometryCompressedParams}.
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
     * @returns *{@link @xeokit/scene!Geometry}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid GeometryParams were given.
     * * Geometry of given ID already exists in this SceneModel.
     * * Unsupported primitive type given.
     * * Mandatory vertex positions were not given. Vertex positions are mandatory for all primitive types.
     * * Mandatory indices were not given for primitive type that is not {@link @xeokit/constants!PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
     * * Indices out of range of vertex positions.
     * * Indices out of range of vertex UVs.
     * * Mismatch between given quantities of vertex positions and UVs.
     */
    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): Geometry | SDKError {
        if (this.destroyed) {
            return new SDKError("Failed to add compressed Geometry to SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to add compressed Geometry to SceneModel - SceneModel already built");
        }
        if (!geometryCompressedParams) {
            return new SDKError("Failed to add compressed Geometry to SceneModel - Parameters expected: geometryCompressedParams");
        }
        const geometryId = geometryCompressedParams.id;
        if (this.geometries[geometryId]) {
            return new SDKError(`Failed to add compressed Geometry to SceneModel - Geometry with this ID already created: ${geometryId}`);
        }
        const primitive = geometryCompressedParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            return new SDKError(`Failed to add compressed Geometry to SceneModel - Unsupported value for geometryCompressedParams.primitive: '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
        }
        const geometry = new Geometry(geometryCompressedParams);
        this.geometries[geometryId] = geometry;
        this.stats.numGeometries++;
        return geometry;
    }

    /**
     * Creates a new {@link @xeokit/scene!Mesh} within this SceneModel.
     *
     * * Stores the new {@link @xeokit/scene!Mesh} in {@link @xeokit/scene!SceneModel.meshes | SceneModel.meshes}.
     * * A {@link @xeokit/scene!Mesh} can be owned by one {@link @xeokit/scene!SceneObject}, which can own multiple {@link @xeokit/scene!Mesh}es.
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
     * @returns *{@link @xeokit/scene!Mesh}*
     *  * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid MeshParams were given.
     * * Mesh of given ID already exists in this SceneModel.
     * * Specified Geometry could not be found in this SceneModel.
     * * Specified TextureSet could not be found in this SceneModel.
     */
    createMesh(meshParams: MeshParams): Mesh | SDKError {
        if (this.destroyed) {
            return new SDKError("Failed to create Mesh in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create Mesh in SceneModel - SceneModel already built");
        }
        if (this.meshes[meshParams.id]) {
            return new SDKError(`Failed to create Mesh in SceneModel - Mesh already exists with this ID: ${meshParams.id}`);
        }
        const geometry = this.geometries[meshParams.geometryId];
        if (!geometry) {
            return new SDKError(`Failed to create Mesh in SceneModel - Geometry not found: ${meshParams.geometryId}`);
        }
        const textureSet = meshParams.textureSetId ? this.textureSets[meshParams.textureSetId] : undefined;
        if (meshParams.textureSetId && !textureSet) {
            return new SDKError(`Failed to create Mesh in SceneModel - TextureSet not found: ${meshParams.textureSetId}`);
        }

        // geometry.numInstances++;
        // let matrix = meshParams.matrix;
        // if (!matrix) {
        //     const position = meshParams.position;
        //     const scale = meshParams.scale;
        //     const rotation = meshParams.rotation;
        //     if (position || scale || rotation) {
        //         matrix = identityMat4();
        //         const quaternion = eulerToQuat(rotation || [0, 0, 0], "XYZ", identityQuat());
        //         composeMat4(position || [0, 0, 0], quaternion, scale || [1, 1, 1], matrix)
        //     } else {
        //         matrix = identityMat4();
        //     }
        // }
        // const meshIndex = this.meshesList.length;

        const mesh = new Mesh({
            id: meshParams.id,
            geometry,
            textureSet,
            matrix: meshParams.matrix,
            color: meshParams.color,
            opacity: meshParams.opacity,
            roughness: meshParams.roughness,
            metallic: meshParams.metallic
        });
        this.meshes[meshParams.id] = mesh;
        this.stats.numMeshes++;
        return mesh;
    }

    /**
     * Creates a new {@link @xeokit/scene!SceneObject}.
     *
     * * Stores the new {@link @xeokit/scene!SceneObject} in {@link @xeokit/scene!SceneModel.objects | SceneModel.objects} and {@link @xeokit/scene!Scene.objects | Scene.objects}.
     * * Fires an event via {@link @xeokit/scene!Scene.onObjectCreated | Scene.onObjectCreated}.
     * * Each {@link @xeokit/scene!Mesh} is allowed to belong to one SceneObject.
     * * SceneObject IDs must be unique within the SceneModel's {@link @xeokit/scene!Scene}.
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
     * @returns *{@link @xeokit/scene!SceneObject}*
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
    createObject(objectParams: SceneObjectParams): SceneObject | SDKError {
        if (this.destroyed) {
            return new SDKError("Failed to create SceneObject - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create SceneObject SceneModel already built");
        }
        if (objectParams.meshIds.length === 0) {
            return new SDKError("Failed to create SceneObject - no meshes specified");
        }
        if (this.scene.objects[objectParams.id]) {
            return new SDKError(`Failed to create SceneObject - SceneObject already exists in Scene: ${objectParams.id}`);
        }
        const meshIds = objectParams.meshIds;
        const meshes = [];
        for (let meshIdIdx = 0, meshIdLen = meshIds.length; meshIdIdx < meshIdLen; meshIdIdx++) {
            const meshId = meshIds[meshIdIdx];
            const mesh = this.meshes[meshId];
            if (!mesh) {
                return new SDKError(`Failed to create SceneObject - Mesh not found: ${meshId}`);
            }
            if (this.#meshUsedByObject[meshId]) {
                return new SDKError(`Failed to create SceneObject - Mesh ${meshId} already belongs to another SceneObject`);
            }
            meshes.push(mesh);
            this.#meshUsedByObject[mesh.id] = true;
        }
        const sceneObject = new SceneObject({
            id: objectParams.id,
            layerId: objectParams.layerId || this.layerId,
            model: this,
            meshes
        });
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            mesh.object = sceneObject;
        }
        this.#numObjects++;
        this.objects[objectParams.id] = sceneObject;
        this.stats.numObjects++;
        return sceneObject;
    }

    /**
     * Finalizes this SceneModel, readying it for use.
     *
     * * Fires an event via {@link @xeokit/scene!SceneModel.onBuilt | SceneModel.onBuilt} and {@link @xeokit/scene!Scene.onModelCreated | SceneModel.onCreated}, to indicate to subscribers that
     * the SceneModel is complete and ready to use.
     * * Sets {@link @xeokit/scene!SceneModel.built | SceneModel.built} ````true````.
     * * You can only call this method once on a SceneModel.
     * * The SceneModel must have at least one {@link @xeokit/scene!SceneObject}.
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
    build(): Promise<SceneModel> {
        return new Promise<SceneModel>((resolve) => {
            if (this.destroyed) {
                throw new SDKError("Failed to build SceneModel - SceneModel already destroyed");
            }
            if (this.built) {
                throw new SDKError("Failed to build SceneModel - SceneModel already built");
            }
            this.#removeUnusedTextures();
           // this.#compressTextures().then(() => {
                this.built = true;
                this.onBuilt.dispatch(this, null);
                resolve(this);
            // }).catch((e) => {
            //     throw e;
            // });
        });
    }

    #removeUnusedTextures() {
        // let texturesList = [];
        // const textures = {};
        // for (let i = 0, leni = this.texturesList.length; i < leni; i++) {
        //     const texture = this.texturesList[i];
        //     if (texture.channel !== null) {
        //         texture.textureIndex = texturesList.length;
        //         texturesList.push(texture);
        //         textures[texture.id] = texture;
        //     }
        // }
        // this.texturesList = texturesList;
        // this.textures = textures;
    }

    // #compressTextures(): Promise<any> {
    //     let countTextures = this.#texturesList.length;
    //     return new Promise<void>((resolve) => {
    //         if (countTextures === 0) {
    //             resolve();
    //             return;
    //         }
    //         for (let i = 0, leni = this.#texturesList.length; i < leni; i++) {
    //             const texture = this.#texturesList[i];
    //             const encodingOptions = TEXTURE_ENCODING_OPTIONS[texture.channel] || {};
    //             if (texture.src) {  // Texture created with SceneModel#createTexture({ src: ... })
    //                 const src = texture.src;
    //                 const fileExt = src.split('.').pop();
    //                 switch (fileExt) {
    //                     case "jpeg":
    //                     case "jpg":
    //                     case "png":
    //
    //                         load(src, ImageLoader, {
    //                             image: {
    //                                 type: "data"
    //                             }
    //                         }).then((imageData) => {
    //                             if (texture.compressed) {
    //                                 encode(imageData, KTX2BasisWriter, encodingOptions).then((encodedData) => {
    //                                     const encodedImageData = new Uint8Array(encodedData);
    //                                     this.stats.textureBytes += encodedImageData.byteLength;
    //                                     texture.imageData = encodedImageData;
    //                                     if (--countTextures <= 0) {
    //                                         resolve();
    //                                     }
    //                                 }).catch((err) => {
    //                                     return new SDKError(`Failed to compress texture: ${err}`);
    //                                 });
    //                             } else {
    //                                 texture.imageData = new Uint8Array(1);
    //                                 if (--countTextures <= 0) {
    //                                     resolve();
    //                                 }
    //                             }
    //                         }).catch((err) => {
    //                             return new SDKError(`Failed to load texture image: ${err}`);
    //                         });
    //                         break;
    //                     default:
    //                         if (--countTextures <= 0) {
    //                             resolve();
    //                         }
    //                         break;
    //                 }
    //             }
    //             if (texture.imageData) {// Texture created with SceneModel#createTexture({ imageData: ... })
    //                 if (texture.compressed) {
    //                     encode(texture.imageData, KTX2BasisWriter, encodingOptions)
    //                         .then((encodedImageData) => {
    //                             texture.imageData = new Uint8Array(encodedImageData);
    //                             this.stats.textureBytes += texture.imageData.byteLength;
    //                             if (--countTextures <= 0) {
    //                                 resolve();
    //                             }
    //                         }).catch((err) => {
    //                         return new SDKError(`Failed to compress texture: ${err}`);
    //                     });
    //                 } else {
    //                     texture.imageData = new Uint8Array(1);
    //                     if (--countTextures <= 0) {
    //                         resolve();
    //                     }
    //                 }
    //             }
    //         }
    //     });
    // }
}
