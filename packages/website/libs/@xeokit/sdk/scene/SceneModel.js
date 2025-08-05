// import {KTX2BasisWriter} from "@loaders.gl/textures";
// import {ImageLoader} from '@loaders.gl/images';
import { EventDispatcher } from "strongly-typed-events";
import { Component, EventEmitter, SDKError } from "../core";
import { LinesPrimitive, PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive } from "../constants";
import { collapseAABB3, createAABB3, expandAABB3 } from "../boundaries";
import { SceneGeometry } from "./SceneGeometry";
import { SceneObject } from "./SceneObject";
import { SceneTextureSet } from "./SceneTextureSet";
import { SceneTexture } from "./SceneTexture";
import { SceneMesh } from "./SceneMesh";
import { compressGeometryParams } from "./compressGeometryParams";
import { composeMat4, createVec3, eulerToQuat, identityMat4, identityQuat } from "../matrix";
import { SceneQuantizationRange } from "./SceneQuantizationRange";
import { createRTCModelMat } from "../rtc";
// XGF texture types
const COLOR_TEXTURE = 0;
const METALLIC_ROUGHNESS_TEXTURE = 1;
const NORMALS_TEXTURE = 2;
const EMISSIVE_TEXTURE = 3;
const OCCLUSION_TEXTURE = 4;
// KTX2 encoding options for each texture type
const TEXTURE_ENCODING_OPTIONS = {};
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
 * Contains a model's geometry and materials
 *
 * * Created with {@link scene!Scene.createModel | Scene.createModel}
 * * Stored in {@link scene!Scene.models | Scene.models}
 * * Contains {@link scene!SceneObject | SceneObjects}, {@link scene!SceneMesh | SceneMeshes}, {@link scene!SceneGeometry | Geometries} and {@link scene!SceneTexture | Textures}.
 * * View with a {@link viewer!Viewer | Viewer}
 * * Import and export various file formats
 * * Build programmatically
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneModel extends Component {
    /**
     * Indicates what renderer resources will need to be allocated in a {@link viewer!Viewer | Viewer's}
     * {@link viewer!Renderer | Renderer} to support progressive loading for the {@link scene!SceneModel | SceneModel}.
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
     */
    streamParams;
    /**
     * The {@link scene!Scene | Scene} that contains this SceneModel.
     */
    scene;
    /**
     * If we want to view this SceneModel with a {@link viewer!Viewer | Viewer}, an
     * optional ID of a {@link viewer!ViewLayer | ViewLayer} to view it in.
     */
    layerId;
    /**
     * Indicates if this SceneModel has already been built.
     *
     * * Set ````true```` by {@link scene!SceneModel.build | SceneModel.build}.
     * * Subscribe to updates using {@link scene!SceneModel.onBuilt | SceneModel.onBuilt}
     * and {@link scene!Scene.onModelCreated | Scene.onModelCreated}.
     * * Don't create anything more in this SceneModel once it's built.
     */
    built;
    /**
     * The edge threshold for automatic [edge primitive generation](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#geometry-edge-generation).
     */
    edgeThreshold;
    /**
     * {@link scene!SceneGeometry | Geometries} within this SceneModel, each mapped to {@link scene!SceneGeometry.id | SceneGeometry.id}.
     *
     * * Created by {@link scene!SceneModel.createGeometry | SceneModel.createGeometry}.
     */
    geometries;
    /**
     * {@link scene!SceneQuantizationRange | SceneQuantizationRanges} within this SceneModel, each mapped to {@link scene!SceneQuantizationRange.id | SceneQuantizationRange.id}.
     *
     * * Created by {@link scene!SceneModel.createGeometry | SceneModel.createGeometry}.
     */
    quantizationRanges;
    /**
     * {@link scene!SceneTexture | Textures} within this SceneModel, each mapped to {@link scene!SceneTexture.id | SceneTexture.id}.
     *
     * * Created by {@link scene!SceneModel.createTexture | SceneModel.createTexture}.
     * * Compressed asynchronously in {@link scene!SceneModel.build | SceneModel.build}.
     */
    textures;
    /**
     * {@link scene!SceneTextureSet | TextureSets} within this SceneModel, each mapped to {@link scene!SceneTextureSet.id | SceneTextureSet.id}.
     *
     * * Created by {@link scene!SceneModel.createTextureSet | SceneModel.createTextureSet}.
     */
    textureSets;
    /**
     * The {@link scene!SceneTile | Tiles} used by this SceneModel, each mapped to {@link scene!SceneTile.id | SceneTile.id}.
     */
    tiles;
    /**
     * The {@link scene!SceneTile | Tiles} used by this SceneModel.
     */
    tilesList;
    /**
     * {@link scene!SceneMesh | SceneMeshes} within this SceneModel, each mapped to {@link scene!SceneMesh.id | SceneMesh.id}.
     *
     * * Created by {@link scene!SceneModel.addMesh | SceneModel.addMesh}.
     */
    meshes;
    /**
     * {@link scene!SceneObject | SceneObjects} within this SceneModel, each mapped to {@link scene!SceneObject.id | SceneObject.id}.
     *
     * * Created by {@link scene!SceneModel.createObject | SceneModel.createObject}.
     */
    objects;
    /**
     * List of {@link scene!SceneObject | SceneObjects} within this SceneModel.
     *
     * * Created by {@link scene!SceneModel.createObject | SceneModel.createObject}.
     */
    objectsList;
    /**
     * Emits an event when this {@link scene!SceneModel | SceneModel} has been built.
     *
     * * Triggered by {@link scene!SceneModel.build | SceneModel.build}.
     *
     * @event onBuilt
     */
    onBuilt;
    /**
     *  Internal interface through which a SceneModel can load updated content into a renderers.
     *
     * @internal
     */
    rendererModel;
    /**
     * Statistics on this SceneModel.
     */
    stats;
    /**
     * TODO
     *
     * @see {@link scene!SceneModelParams | SceneModelParams}.
     */
    retained;
    #texturesList;
    #numObjects;
    #meshUsedByObject;
    #aabb;
    #aabbDirty;
    /**
     * @private
     */
    constructor(scene, sceneModelParams) {
        super(scene, {
            id: sceneModelParams.id
        });
        this.scene = scene;
        this.tiles = {};
        this.tilesList = [];
        this.onBuilt = new EventEmitter(new EventDispatcher());
        this.onDestroyed = new EventEmitter(new EventDispatcher());
        this.#numObjects = 0;
        this.#meshUsedByObject = {};
        this.#aabb = createAABB3();
        this.#aabbDirty = true;
        this.streamParams = sceneModelParams.streamParams;
        this.globalizedIds = (!!sceneModelParams.globalizedIds);
        this.id = sceneModelParams.id || "default";
        this.layerId = sceneModelParams.layerId;
        this.edgeThreshold = 10;
        this.geometries = {};
        this.quantizationRanges = {};
        this.textures = {};
        this.#texturesList = [];
        this.textureSets = {};
        this.meshes = {};
        this.objects = {};
        this.objectsList = [];
        this.built = false;
        this.rendererModel = null;
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
        this.retained = (sceneModelParams.retained !== false);
    }
    /**
     * Creates components in this SceneModel from JSON.
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
     *
     * @param sceneModelParams
     * @returns *void*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this SceneModel has already been built.
     * * If this SceneModel has already been destroyed.
     * * A duplicate component ({@link scene!SceneObject}, {@link scene!SceneMesh},
     * {@link scene!SceneGeometry | SceneGeometry}, {@link scene!SceneTexture} etc.) was already created within this SceneModel.
     */
    fromJSON(sceneModelParams) {
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
        if (sceneModelParams.geometriesCompressed) {
            for (let i = 0, len = sceneModelParams.geometriesCompressed.length; i < len; i++) {
                this.createGeometryCompressed(sceneModelParams.geometriesCompressed[i]);
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
     * Creates a new {@link scene!SceneTexture} within this SceneModel.
     *
     * * Stores the new {@link scene!SceneTexture} in {@link scene!SceneModel.textures | SceneModel.textures}.
     * * Textures are compressed asynchronously by {@link scene!SceneModel.build | SceneModel.build}.
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
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more usage info.
     *
     * @param textureParams - SceneTexture creation parameters.
     * @returns *{@link scene!SceneTexture}*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If SceneModel has already been built or destroyed.
     * * Invalid SceneTextureParams were given.
     * * SceneTexture with given ID already exists in this Scene.
     */
    createTexture(textureParams) {
        if (this.destroyed) {
            return new SDKError("Failed to create SceneTexture in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create SceneTexture in SceneModel - SceneModel already built");
        }
        if (!textureParams.imageData && !textureParams.src && !textureParams.buffers) {
            return new SDKError("Failed to create SceneTexture in SceneModel - Parameter expected: textureParams.imageData, textureParams.src or textureParams.buffers");
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
        const texture = new SceneTexture(textureParams);
        this.textures[textureParams.id] = texture;
        this.#texturesList.push(texture);
        this.stats.numTextures++;
        return texture;
    }
    /**
     * Creates a new {@link scene!SceneTextureSet} within this SceneModel.
     *
     * * Stores the new {@link scene!SceneTextureSet} in {@link scene!SceneModel.textureSets | SceneModel.textureSets}.
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
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more usage info.
     *
     * @param textureSetParams SceneTextureSet creation parameters.
     *
     * @returns *{@link scene!SceneTextureSet}*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If SceneModel has already been built or destroyed.
     * * Invalid SceneTextureSetParams were given.
     * * SceneTextureSet with given ID already exists in this SceneModel.
     * * One or more of the given Textures could not be found in this SceneModel.
     */
    createTextureSet(textureSetParams) {
        if (this.destroyed) {
            return new SDKError("Failed to create SceneTextureSet in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create SceneTextureSet in SceneModel - SceneModel already built");
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
        const textureSet = new SceneTextureSet(textureSetParams, {
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
     * Creates a new {@link scene!SceneGeometry | SceneGeometry} within this SceneModel, from non-compressed geometry parameters.
     *
     * * Stores the new {@link scene!SceneGeometry | SceneGeometry} in {@link scene!SceneModel.geometries | SceneModel.geometries}.
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
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more usage info.
     *
     * @param geometryParams Non-compressed geometry parameters.
     * @returns *{@link scene!SceneGeometry | SceneGeometry}*
     *  * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid SceneGeometryParams were given.
     * * SceneGeometry of given ID already exists in this SceneModel.
     * * Unsupported primitive type given.
     * * Mandatory vertex positions were not given. Vertex positions are mandatory for all primitive types.
     * * Mandatory indices were not given for primitive type that is not {@link constants!PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
     * * Indices out of range of vertex positions.
     * * Indices out of range of vertex UVs.
     * * Mismatch between given quantities of vertex positions and UVs.
     */
    createGeometry(geometryParams) {
        if (this.destroyed) {
            return new SDKError("Failed to create SceneGeometry in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create SceneGeometry in SceneModel - SceneModel already built");
        }
        if (!geometryParams) {
            return new SDKError("Failed to create SceneGeometry in SceneModel - Parameters expected: geometryParams");
        }
        if (geometryParams.id === null || geometryParams.id === undefined) {
            return new SDKError("Failed to create SceneGeometry in SceneModel - Parameter expected: geometryParams.id");
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
            return new SDKError("Failed to create SceneGeometry in SceneModel - Param expected: geometryParams.positions");
        }
        if (!geometryParams.indices && primitive !== PointsPrimitive) {
            return new SDKError(`Failed to create Geometry in SceneModel - Param expected: geometryParams.indices (required for primitive type)`);
        }
        if (geometryParams.uvs) {
            if (geometryParams.uvs.length / 2 !== geometryParams.positions.length / 3) {
                return new SDKError("Failed to create SceneGeometry in SceneModel - mismatch between given quantities of vertex positions and UVs");
            }
        }
        if (geometryParams.indices) {
            const lastPositionsIdx = geometryParams.positions.length / 3;
            for (let i = 0, len = geometryParams.indices.length; i < len; i++) {
                const idx = geometryParams.indices[i];
                if (idx < 0 || idx >= lastPositionsIdx) {
                    return new SDKError("Failed to create SceneGeometry in SceneModel - indices out of range of vertex positions");
                }
                if (geometryParams.uvs) {
                    const lastUVsIdx = geometryParams.uvs.length / 2;
                    if (idx < 0 || idx >= lastUVsIdx) {
                        return new SDKError("Failed to create SceneGeometry in SceneModel - indices out of range of vertex UVs");
                    }
                }
            }
        }
        const geometry = new SceneGeometry(compressGeometryParams(geometryParams));
        this.geometries[geometryId] = geometry;
        this.stats.numGeometries++;
        if (geometryParams.indices) {
            if (geometry.primitive === TrianglesPrimitive) {
                this.stats.numTriangles += geometryParams.indices.length / 3;
            }
            else if (geometry.primitive === LinesPrimitive) {
                this.stats.numLines += geometryParams.indices.length / 2;
            }
        }
        else if (geometry.primitive === PointsPrimitive) {
            this.stats.numPoints += geometryParams.positions.length / 3;
        }
        this.stats.numVertices += geometryParams.positions.length / 3;
        return geometry;
    }
    /**
     * Creates a new {@link scene!SceneGeometry | SceneGeometry} within this SceneModel, from pre-compressed geometry parameters.
     *
     * * Stores the new {@link scene!SceneGeometry | SceneGeometry} in {@link scene!SceneModel.geometries | SceneModel.geometries}.
     * * Use {@link scene!compressGeometryParams | compressGeometryParams} to pre-compress {@link scene!SceneGeometryParams | SceneGeometryParams}
     * into {@link scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
     *
     * ### Usage
     *
     * ````javascript
     * const boxGeometry = sceneModel.createGeometryCompressed({
     *      id: "boxGeometry",
     *      primitive: TrianglesPrimitive, // @xeokit/constants
     *      aabb: [-1,-1,-1, 1,1,1],
     *      positionsCompressed: [
     *          65525, 65525, 65525, 0, 65525, 65525, 0, 0,
     *          65525, 65525, 0, 65525, 65525, 0, 0, 65525,
     *          65525, 0, 0, 65525, 0, 0, 0, 0
     *      ],
     *      indices: [
     *          0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
     *          0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
     *          4, 7, 6, 4, 6, 5
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
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more usage info.
     *
     * @param geometryCompressedParams Pre-compressed geometry parameters.
     * @returns *{@link scene!SceneGeometry | SceneGeometry}*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid SceneGeometryParams were given.
     * * SceneGeometry of given ID already exists in this SceneModel.
     * * Unsupported primitive type given.
     * * Mandatory vertex positions were not given. Vertex positions are mandatory for all primitive types.
     * * Mandatory indices were not given for primitive type that is not {@link constants!PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
     * * Indices out of range of vertex positions.
     * * Indices out of range of vertex UVs.
     * * Mismatch between given quantities of vertex positions and UVs.
     */
    createGeometryCompressed(geometryCompressedParams) {
        if (this.destroyed) {
            return new SDKError("Failed to add compressed SceneGeometry to SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to add compressed SceneGeometry to SceneModel - SceneModel already built");
        }
        if (!geometryCompressedParams) {
            return new SDKError("Failed to add compressed SceneGeometry to SceneModel - Parameters expected: geometryCompressedParams");
        }
        const geometryId = geometryCompressedParams.id;
        if (this.geometries[geometryId]) {
            return new SDKError(`Failed to add compressed Geometry to SceneModel - Geometry with this ID already created: ${geometryId}`);
        }
        const primitive = geometryCompressedParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            return new SDKError(`Failed to add compressed Geometry to SceneModel - Unsupported value for geometryCompressedParams.primitive: '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
        }
        const geometry = new SceneGeometry(geometryCompressedParams);
        this.geometries[geometryId] = geometry;
        this.stats.numGeometries++;
        return geometry;
    }
    /**
     *
     * @param quantizationRangeParams
     */
    createQuantizationRange(quantizationRangeParams) {
        if (this.destroyed) {
            return new SDKError("Failed to add SceneQuantizationRange to SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to add SceneQuantizationRange to SceneModel - SceneModel already built");
        }
        if (!quantizationRangeParams) {
            return new SDKError("Failed to add SceneQuantizationRange to SceneModel - Parameters expected: geometryCompressedParams");
        }
        const quantizationRangeId = quantizationRangeParams.id;
        if (this.quantizationRanges[quantizationRangeId]) {
            return new SDKError(`Failed to add SceneQuantizationRange to SceneModel - SceneQuantizationRange with this ID already created: ${quantizationRangeId}`);
        }
        const quantizationRange = new SceneQuantizationRange(quantizationRangeParams);
        this.quantizationRanges[quantizationRangeId] = quantizationRange;
        return quantizationRange;
    }
    /**
     * Creates a new {@link scene!SceneMesh} within this SceneModel.
     *
     * * Stores the new {@link scene!SceneMesh} in {@link scene!SceneModel.meshes | SceneModel.meshes}.
     * * A {@link scene!SceneMesh} can be owned by one {@link scene!SceneObject}, which can own multiple {@link scene!SceneMesh}es.
     *
     * ### Usage
     *
     * ````javascript
     * const redBoxMesh = sceneModel.createLayerMesh({
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
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more usage info.
     *
     * @param meshParams Pre-compressed mesh parameters.
     * @returns *{@link scene!SceneMesh}*
     *  * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid SceneMeshParams were given.
     * * SceneMesh of given ID already exists in this SceneModel.
     * * Specified SceneGeometry could not be found in this SceneModel.
     * * Specified SceneTextureSet could not be found in this SceneModel.
     */
    createMesh(meshParams) {
        if (this.destroyed) {
            return new SDKError("Failed to create SceneMesh in SceneModel - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create SceneMesh in SceneModel - SceneModel already built");
        }
        if (this.meshes[meshParams.id]) {
            return new SDKError(`Failed to create SceneMesh in SceneModel - SceneMesh already exists with this ID: ${meshParams.id}`);
        }
        const geometry = this.geometries[meshParams.geometryId];
        if (!geometry) {
            return new SDKError(`Failed to create SceneMesh in SceneModel - Geometry not found: ${meshParams.geometryId}`);
        }
        const textureSet = meshParams.textureSetId ? this.textureSets[meshParams.textureSetId] : undefined;
        if (meshParams.textureSetId && !textureSet) {
            return new SDKError(`Failed to create SceneMesh in SceneModel - TextureSet not found: ${meshParams.textureSetId}`);
        }
        let matrix = meshParams.matrix;
        if (!matrix) {
            const position = meshParams.position;
            const scale = meshParams.scale;
            const rotation = meshParams.rotation;
            const quaternion = meshParams.quaternion;
            if (position || scale || rotation || quaternion) {
                matrix = identityMat4();
                composeMat4(position || [0, 0, 0], quaternion || eulerToQuat(rotation || [0, 0, 0], "XYZ", identityQuat()), scale || [1, 1, 1], matrix);
            }
            else {
                matrix = identityMat4();
            }
        }
        else {
            matrix = matrix.slice();
        }
        let origin;
        let rtcMatrix;
        if (meshParams.origin) {
            origin = meshParams.origin;
            rtcMatrix = matrix;
        }
        else {
            origin = createVec3();
            rtcMatrix = createRTCModelMat(matrix, origin);
        }
        const tile = this.scene.getTile(origin);
        if (!this.tiles[tile.id]) {
            this.tiles[tile.id] = tile;
            this.tilesList.push(tile);
        }
        const mesh = new SceneMesh({
            id: meshParams.id,
            geometry,
            textureSet,
            matrix,
            rtcMatrix,
            color: meshParams.color,
            opacity: meshParams.opacity,
            tile
        });
        geometry.numMeshes++;
        this.meshes[meshParams.id] = mesh;
        this.stats.numMeshes++;
        return mesh;
    }
    /**
     * Creates a new {@link scene!SceneObject}.
     *
     * * Stores the new {@link scene!SceneObject} in {@link scene!SceneModel.objects | SceneModel.objects} and {@link scene!Scene.objects | Scene.objects}.
     * * Fires an event via {@link scene!Scene.onObjectCreated | Scene.onObjectCreated}.
     * * Each {@link scene!SceneMesh} is allowed to belong to one SceneObject.
     * * SceneObject IDs must be unique within the SceneModel's {@link scene!Scene | Scene}.
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
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more usage info.
     *
     * @param objectParams SceneObject parameters.
     * @returns *{@link scene!SceneObject}*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this SceneModel has already been destroyed.
     * * If this SceneModel has already been built.
     * * Invalid ObjectParams were given.
     * * SceneObject of given ID already exists in this SceneModel's Scene. Note that SceneObject IDs must be unique within the Scene.
     * * No Meshes were specified.
     * * One or more of the specified Meshes already belong to another SceneObject in this SceneModel.
     * * Specified Meshes could not be found in this SceneModel.
     */
    createObject(objectParams) {
        if (this.destroyed) {
            return new SDKError("Failed to create SceneObject - SceneModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Failed to create SceneObject SceneModel already built");
        }
        if (objectParams.meshIds.length === 0) {
            return new SDKError("Failed to create SceneObject - no meshes specified");
        }
        const objectId = this.globalizedIds ? `${this.id}.${objectParams.id}` : objectParams.id;
        if (this.scene.objects[objectId]) {
            return new SDKError(`Failed to create SceneObject - SceneObject already exists in Scene: ${objectId}`);
        }
        const meshIds = objectParams.meshIds;
        const meshes = [];
        for (let meshIdIdx = 0, meshIdLen = meshIds.length; meshIdIdx < meshIdLen; meshIdIdx++) {
            const meshId = meshIds[meshIdIdx];
            const mesh = this.meshes[meshId];
            if (!mesh) {
                return new SDKError(`Failed to create SceneObject - SceneMesh not found: ${meshId}`);
            }
            if (this.#meshUsedByObject[meshId]) {
                return new SDKError(`Failed to create SceneObject - SceneMesh ${meshId} already belongs to another SceneObject`);
            }
            meshes.push(mesh);
            this.#meshUsedByObject[mesh.id] = true;
        }
        const sceneObject = new SceneObject({
            id: objectId,
            originallSystemId: objectParams.originalSystemId,
            layerId: this.layerId || objectParams.layerId,
            model: this,
            meshes
        });
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            mesh.object = sceneObject;
        }
        this.#numObjects++;
        this.objects[objectId] = sceneObject;
        this.objectsList.push(sceneObject);
        this.stats.numObjects++;
        return sceneObject;
    }
    /**
     * Finalizes this SceneModel, readying it for use.
     *
     * * Fires an event via {@link scene!SceneModel.onBuilt | SceneModel.onBuilt} and {@link scene!Scene.onModelCreated | SceneModel.onCreated}, to indicate to subscribers that
     * the SceneModel is complete and ready to use.
     * * Sets {@link scene!SceneModel.built | SceneModel.built} ````true````.
     * * You can only call this method once on a SceneModel.
     * * The SceneModel must have at least one {@link scene!SceneObject}.
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
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more usage info.
     *
     * @throws *{@link core!SDKError | SDKError}*
     * * If SceneModel has already been built or destroyed.
     * * If no SceneObjects were created in this SceneModel.
     */
    build() {
        return new Promise((resolve) => {
            if (this.destroyed) {
                throw new SDKError("Failed to build SceneModel - SceneModel already destroyed");
            }
            if (this.built) {
                throw new SDKError("Failed to build SceneModel - SceneModel already built");
            }
            this.#removeUnusedComponents();
            // this.#compressTextures().then(() => {
            this.built = true;
            this.onBuilt.dispatch(this, null);
            resolve(this);
            // }).catch((e) => {
            //     throw e;
            // });
        });
    }
    #removeUnusedComponents() {
        for (let id in this.meshes) {
            const mesh = this.meshes[id];
            if (!mesh.object) {
                mesh.geometry.numMeshes--;
                delete this.meshes[id];
            }
        }
        for (let id in this.geometries) {
            if (this.geometries[id].numMeshes === 0) {
                delete this.geometries[id];
            }
        }
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
    /**
     * Gets the axis-aligned 3D World-space boundary of this SceneModel.
     */
    get aabb() {
        if (this.objectsList.length === 1) {
            return this.objectsList[0].aabb;
        }
        if (this.#aabbDirty) {
            if (!this.#aabb) {
                this.#aabb = collapseAABB3();
            }
            else {
                collapseAABB3(this.#aabb);
            }
            for (let i = 0, len = this.objectsList.length; i < len; i++) {
                expandAABB3(this.#aabb, this.objectsList[i].aabb);
            }
            this.#aabbDirty = false;
        }
        return this.#aabb;
    }
    /**
     * Gets this SceneModel as JSON.
     */
    getJSON() {
        const sceneModelParams = {
            id: this.id,
            geometriesCompressed: [],
            textures: [],
            textureSets: [],
            transforms: [],
            meshes: [],
            objects: []
        };
        if (this.streamParams) {
            sceneModelParams.streamParams = this.streamParams;
        }
        Object.entries(this.geometries).forEach(([key, sceneGeometry]) => {
            sceneModelParams.geometriesCompressed.push(sceneGeometry.getJSON());
        });
        // Object.entries(this.textures).forEach(([key, value]) => {
        //     sceneModelParams.textures[key] = (<SceneTexture>value).getJSON();
        // });
        // Object.entries(this.textureSets).forEach(([key, value]) => {
        //     sceneModelParams.textureSets[key] = (<SceneTextureSet>value).getJSON();
        // });
        Object.entries(this.meshes).forEach(([key, sceneMesh]) => {
            sceneModelParams.meshes.push(sceneMesh.getJSON());
        });
        Object.entries(this.objects).forEach(([key, sceneObject]) => {
            sceneModelParams.objects.push(sceneObject.getJSON());
        });
        return sceneModelParams;
    }
    /**
     * Destroys this SceneModel.
     *
     * Sets {@link Component.destroyed} ````true````.
     */
    destroy() {
        for (let i = 0, len = this.tilesList.length; i < len; i++) {
            this.scene.putTile(this.tilesList[i]);
        }
        this.onDestroyed.dispatch(this, null);
        super.destroy();
    }
}
//# sourceMappingURL=SceneModel.js.map
