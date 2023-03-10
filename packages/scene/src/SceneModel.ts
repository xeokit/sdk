import {EventDispatcher} from "strongly-typed-events";

import {Component, EventEmitter} from "@xeokit/core/components";

import {
    LinesPrimitive,
    PointsPrimitive,
    SolidPrimitive,
    SurfacePrimitive,
    TrianglesPrimitive
} from "@xeokit/core/constants";

import {createMat4, createVec4} from "@xeokit/math/matrix";

import {createUUID} from "@xeokit/core/utils";
import {createAABB3} from "@xeokit/math/boundaries";

import {Geometry} from "./Geometry";
import {SceneObject} from "./SceneObject";
import {TextureSet} from "./TextureSet";
import {Texture} from "./Texture";
import {Mesh} from "./Mesh";
import {RendererModel} from "./RendererModel";
import {TransformParams} from "./TransformParams";
import {TextureSetParams} from "./TextureSetParams";
import {GeometryParams} from "./GeometryParams";
import {GeometryCompressedParams} from "./GeometryCompressedParams";
import {MeshParams} from "./MeshParams";
import {ObjectParams} from "./ObjectParams";
import {TextureParams} from "./TextureParams";
import {compressGeometryParams} from "./compressGeometryParams";

const tempVec4a = createVec4([0, 0, 0, 1]);
const tempVec4b = createVec4([0, 0, 0, 1]);
const tempMat4 = createMat4();
const tempMat4b = createMat4();

// XKT texture types

const COLOR_TEXTURE = 0;
const METALLIC_ROUGHNESS_TEXTURE = 1;
const NORMALS_TEXTURE = 2;
const EMISSIVE_TEXTURE = 3;
const OCCLUSION_TEXTURE = 4;

// KTX2 encoding options for each texture type

const TEXTURE_ENCODING_OPTIONS = {}

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
 * A buildable scene model representation, containing objects, meshes, geometries, materials and textures.
 *
 * See usage in:
 *
 * * [@xeokit/scene](/docs/modules/_xeokit_scene.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 * * [@xeokit/xkt](/docs/modules/_xeokit_xkt.html)
 */
export class SceneModel extends Component {

    /**
     * The SceneModel's ID.
     */
    readonly id: string;

    /**
     * Indicates if this SceneModel has already been built.
     *
     * Set ````true```` by {@link SceneModel.build}.
     *
     * Don't create anything more in this SceneModel once it's built.
     */
    declare built: boolean;

    /**
     * Indicates if this SceneModel has been destroyed.
     *
     * Set ````true```` by {@link SceneModel.destroy}.
     *
     * Don't create anything more in this SceneModel once it's destroyed.
     */
    declare readonly destroyed: boolean;

    /**
     * The edge threshold.
     */
    readonly edgeThreshold: number;

    /**
     * {@link @xeokit/scene!Geometry|Geometries} within this SceneModel, each mapped to {@link @xeokit/scene!Geometry.id}.
     *
     * Created by {@link SceneModel.createGeometry}.
     */
    readonly geometries: { [key: string]: Geometry };

    /**
     * {@link Texture | Textures} within this SceneModel, each mapped to {@link Texture.id}.
     *
     * Created by {@link SceneModel.createTexture}.
     */
    readonly textures: { [key: string]: Texture };

    /**
     * {@link TextureSet | TextureSets} within this SceneModel, each mapped to {@link TextureSet.id}.
     *
     * Created by {@link SceneModel.createTextureSet}.
     */
    readonly textureSets: { [key: string]: TextureSet };

    /**
     * {@link Mesh | Meshes} within this SceneModel, each mapped to {@link Mesh.id}.
     *
     * Created by {@link SceneModel.createMesh}.
     */
    readonly meshes: { [key: string]: Mesh };

    /**
     * {@link SceneObject | SceneObjects} within this SceneModel, each mapped to {@link SceneObject.id}.
     *
     * Created by {@link SceneModel.createObject}.
     */
    readonly objects: { [key: string]: SceneObject };

    /**
     * The axis-aligned 3D World-space boundary of this SceneModel.
     *
     * Created by {@link SceneModel.build}.
     */
    readonly aabb: Float64Array;

    /**
     * Emits an event when this {@link @xeokit/scene!SceneModel | SceneModel} has already been built.
     *
     * Triggered by {@link SceneModel.build}.
     *
     * @event onBuilt
     */
    readonly onBuilt: EventEmitter<SceneModel, null>;

    /**
     * Emits an event when this {@link @xeokit/scene!SceneModel | SceneModel} has been destroyed.
     *
     * Triggered by {@link SceneModel.destroy}.
     *
     * @event
     */
    readonly onDestroyed: EventEmitter<SceneModel, null>;

    /**
     *  Internal interface through which a SceneModel can load property updates into a renderer.
     *
     * @internal
     */
    rendererModel?: RendererModel;

    #meshUsedByObject: { [key: string]: boolean };

    /**
     * Constructs a new SceneModel.
     *
     * ````javascript
     * const myScratchModel = new SceneModel();
     * ````
     *
     * @param [cfg] Configuration
     * @param {Number} [cfg.edgeThreshold=10]
     */
    constructor(cfg: { id: string, edgeThreshold?: number } = {
        id: "default",
        edgeThreshold: 10
    }) {
        super(null, {
            id: cfg.id
        });

        this.#meshUsedByObject = {};

        this.onBuilt = new EventEmitter(new EventDispatcher<SceneModel, null>());
        this.onDestroyed = new EventEmitter(new EventDispatcher<SceneModel, null>());

        this.id = cfg.id || "default";
        this.edgeThreshold = cfg.edgeThreshold || 10;
        this.geometries = {};
        this.textures = {};
        this.textureSets = {};
        this.meshes = {};
        this.objects = {};
        this.aabb = createAABB3();
        this.built = false;
    }

    /**
     * Creates a new {@link Transform} within this SceneModel.
     *
     * Registers the new {@link Transform} in {@link SceneModel.transforms}.
     *
     * ````javascript
     * myScratchModel.createTransform({
     *      id: "myTransform",
     *      //...
     * });
     *
     * // SceneModel is a SceneModel, so we can access the TextureSet we just created
     * const textureSet = myScratchModel.textureSets["myTextureSet"];
     * ````
     *
     * @param transformParams Transform creation parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createTransform(transformParams: TransformParams): void {
        if (this.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (this.built) {
            throw new Error("SceneModel already built");
        }
        if (!transformParams) {
            throw new Error("Parameters expected: transformParams");
        }
        if (transformParams.id === null || transformParams.id === undefined) {
            throw new Error("Parameter expected: params.transformId");
        }
    }

    /**
     * Creates a new {@link Texture} within this SceneModel.
     *
     * Registers the new {@link Texture} in {@link SceneModel.textures}.
     *
     * ````javascript
     * myScratchModel.createTexture({
     *      id: "myColorTexture",
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
     *
     * // SceneModel is a SceneModel, so we can access the TextureSet we just created
     * const textureSet = myScratchModel.textureSets["myTextureSet"];
     * ````
     *
     * @param textureParams Texture creation parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createTexture(textureParams: TextureParams): void {
        if (this.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (this.built) {
            throw new Error("SceneModel already built");
        }
        if (!textureParams) {
            throw new Error("Parameters expected: textureParams");
        }
        if (textureParams.id === null || textureParams.id === undefined) {
            throw new Error("Parameter expected: textureParams.id");
        }
        if (!textureParams.imageData && !textureParams.src && !textureParams.buffers) {
            throw new Error("Parameter expected: textureParams.imageData, textureParams.src or textureParams.buffers");
        }
        if (this.textures[textureParams.id]) {
            console.error("Texture already exists with this ID: " + textureParams.id);
            return;
        }
        if (textureParams.src) {
            const fileExt = textureParams.src.split('.').pop();
            if (fileExt !== "jpg" && fileExt !== "jpeg" && fileExt !== "png") {
                console.error(`Model does not support image files with extension '${fileExt}' - won't create texture '${textureParams.id}`);
                return;
            }
        }
        this.textures[textureParams.id] = new Texture(textureParams);
    }

    /**
     * Creates a new {@link TextureSet} within this SceneModel.
     *
     * Registers the new {@link TextureSet} in {@link SceneModel.textureSets}.
     *
     * ````javascript
     * myScratchModel.createTextureSet({
     *      id: "myTextureSet",
     *      colorTextureId: "myColorTexture"
     * });
     *
     * // SceneModel is a SceneModel, so we can access the TextureSet we just created
     * const textureSet = myScratchModel.textureSets["myTextureSet"];
     * ````
     *
     * @param textureSetParams TextureSet creation parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createTextureSet(textureSetParams: TextureSetParams): void {
        if (this.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (this.built) {
            throw new Error("SceneModel already built");
        }
        if (!textureSetParams) {
            throw "Parameters expected: textureSetParams";
        }
        if (textureSetParams.id === null || textureSetParams.id === undefined) {
            throw "Parameter expected: textureSetParams.id";
        }
        if (this.textureSets[textureSetParams.id]) {
            console.error("TextureSet already exists with this ID: " + textureSetParams.id);
            return;
        }
        let colorTexture;
        if (textureSetParams.colorTextureId !== undefined && textureSetParams.colorTextureId !== null) {
            colorTexture = this.textures[textureSetParams.colorTextureId];
            if (!colorTexture) {
                console.error(`Texture not found: ${textureSetParams.colorTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
            colorTexture.channel = COLOR_TEXTURE;
        }
        let metallicRoughnessTexture;
        if (textureSetParams.metallicRoughnessTextureId !== undefined && textureSetParams.metallicRoughnessTextureId !== null) {
            metallicRoughnessTexture = this.textures[textureSetParams.metallicRoughnessTextureId];
            if (!metallicRoughnessTexture) {
                console.error(`Texture not found: ${textureSetParams.metallicRoughnessTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
            metallicRoughnessTexture.channel = METALLIC_ROUGHNESS_TEXTURE;
        }
        let normalsTexture;
        if (textureSetParams.normalsTextureId !== undefined && textureSetParams.normalsTextureId !== null) {
            normalsTexture = this.textures[textureSetParams.normalsTextureId];
            if (!normalsTexture) {
                console.error(`Texture not found: ${textureSetParams.normalsTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
            normalsTexture.channel = NORMALS_TEXTURE;
        }
        let emissiveTexture;
        if (textureSetParams.emissiveTextureId !== undefined && textureSetParams.emissiveTextureId !== null) {
            emissiveTexture = this.textures[textureSetParams.emissiveTextureId];
            if (!emissiveTexture) {
                console.error(`Texture not found: ${textureSetParams.emissiveTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
            emissiveTexture.channel = EMISSIVE_TEXTURE;
        }
        let occlusionTexture;
        if (textureSetParams.occlusionTextureId !== undefined && textureSetParams.occlusionTextureId !== null) {
            occlusionTexture = this.textures[textureSetParams.occlusionTextureId];
            if (!occlusionTexture) {
                console.error(`Texture not found: ${textureSetParams.occlusionTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
            occlusionTexture.channel = OCCLUSION_TEXTURE;
        }
        this.textureSets[textureSetParams.colorTextureId] = new TextureSet(textureSetParams, {
            emissiveTexture,
            occlusionTexture,
            metallicRoughnessTexture,
            colorTexture
        });
    }

    /**
     * Creates a new {@link @xeokit/scene!Geometry} within this SceneModel, from non-compressed geometry parameters.
     *
     * ### Usage
     *
     * ````javascript
     * myScratchModel.createGeometry({
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
     *
     * // SceneModel is a SceneModel, so we can access the Geometry we just created
     * const geometry = myScratchModel.geometries["myBoxGeometry"];
     * ````
     *
     * @param geometryParams Non-compressed geometry parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createGeometry(geometryParams: GeometryParams): Geometry {
        if (this.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (this.built) {
            throw new Error("SceneModel already built");
        }
        if (!geometryParams) {
            throw new Error("[createGeometry] Parameters expected: geometryParams");
        }
        if (geometryParams.id === null || geometryParams.id === undefined) {
            throw new Error("[createGeometry] Parameter expected: geometryParams.id");
        }
        const geometryId = geometryParams.id;
        if (this.geometries[geometryId]) {
            this.error(`[createGeometry] Geometry with this ID already created: ${geometryId}`);
            return;
        }
        const primitive = geometryParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            this.error(`[createGeometry] Unsupported value for geometryParams.primitive: '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
            return;
        }
        if (!geometryParams.positions) {
            this.error("[createGeometry] Param expected: geometryParams.positions");
            return;
        }
        if (!geometryParams.indices && primitive !== PointsPrimitive) {
            this.error(`[createGeometry] Param expected: geometryParams.indices (required for primitive type)`);
            return;
        }
        const geometry = new Geometry(<GeometryCompressedParams>compressGeometryParams(geometryParams));
        this.geometries[geometryId] = geometry;
        return geometry;
    }

    /**
     * Creates a new {@link @xeokit/scene!Geometry} within this SceneModel, from pre-compressed geometry parameters.
     *
     * Use {@link @xeokit/math/compression!compressGeometryParams} to pre-compress {@link @xeokit/scene!GeometryParams|GeometryParams} into {@link @xeokit/scene!GeometryCompressedParams|GeometryCompressedParams}.
     *
     * ````javascript
     * myScratchModel.createGeometryCompressed({
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
     *
     * // SceneModel is a SceneModel, so we can access the Geometry we just created
     * const geometry = myScratchModel.geometries["myBoxGeometry"];
     * ````
     *
     * @param geometryCompressedParams Pre-compressed geometry parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): Geometry {
        if (this.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (this.built) {
            throw new Error("SceneModel already built");
        }
        if (!geometryCompressedParams) {
            this.error("[createGeometryCompressed] Parameters expected: geometryCompressedParams");
            return;
        }
        if (geometryCompressedParams.id === null || geometryCompressedParams.id === undefined) {
            this.error("[createGeometryCompressed] Parameter expected: geometryCompressedParams.geometryId");
            return;
        }
        const geometryId = geometryCompressedParams.id;
        if (this.geometries[geometryId]) {
            this.error(`[createGeometryCompressed] Geometry with this ID already created: ${geometryId}`);
            return;
        }
        const primitive = geometryCompressedParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            this.error(`[createGeometryCompressed] Unsupported value for geometryCompressedParams.primitive: '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
            return;
        }
        const geometry = new Geometry(geometryCompressedParams);
        this.geometries[geometryId] = geometry;
        return geometry;
    }

    /**
     * Creates an {@link Mesh} within this SceneModel.
     *
     * ````javascript
     * myScratchModel.createMesh({
     *      id: "redLegMesh",
     *      geometryId: "myBoxGeometry",
     *      textureSetId: "myTextureSet",
     *      position: [-4, -6, -4],
     *      scale: [1, 3, 1],
     *      rotation: [0, 0, 0],
     *      color: [1, 0.3, 0.3]
     * });
     *
     * // SceneModel is a SceneModel, so we can access the Mesh we just created
     * const mesh = myScratchModel.meshes["redLegMesh"];
     * ````
     *
     * An {@link Mesh} can be owned by one {@link SceneObject}, which can own multiple {@link Mesh}es.
     *
     * @param meshParams Pre-compressed mesh parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createMesh(meshParams: MeshParams): void {
        if (this.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (this.built) {
            throw new Error("SceneModel already built");
        }
        if (meshParams.id === null || meshParams.id === undefined) {
            this.error("Parameter expected: meshParams.id");
            return;
        }
        if (meshParams.geometryId === null || meshParams.geometryId === undefined) {
            this.error("Parameter expected: meshParams.geometryId");
            return;
        }
        if (this.meshes[meshParams.id]) {
            this.error("Mesh already exists with this ID: " + meshParams.id);
            return;
        }
        const geometry = this.geometries[meshParams.geometryId];
        if (!geometry) {
            this.error("Geometry not found: " + meshParams.geometryId);
            return;
        }
        const textureSet = meshParams.textureSetId ? this.textureSets[meshParams.textureSetId] : null;
        if (meshParams.textureSetId && !textureSet) {
            this.error("TextureSet not found: " + meshParams.textureSetId);
        }

        // geometry.numInstances++;
        // let matrix = meshParams.matrix;
        // if (!matrix) {
        //     const position = meshParams.position;
        //     const scale = meshParams.scale;
        //     const rotation = meshParams.rotation;
        //     if (position || scale || rotation) {
        //         matrix = identityMat4();
        //         const quaternion = eulerToQuaternion(rotation || [0, 0, 0], "XYZ", identityQuaternion());
        //         composeMat4(position || [0, 0, 0], quaternion, scale || [1, 1, 1], matrix)
        //     } else {
        //         matrix = identityMat4();
        //     }
        // }
        // const meshIndex = this.meshesList.length;

        this.meshes[meshParams.id] = new Mesh({
            id: meshParams.id,
            geometry,
            textureSet,
            matrix: meshParams.matrix,
            color: meshParams.color,
            opacity: meshParams.opacity,
            roughness: meshParams.roughness,
            metallic: meshParams.metallic
        });
    }

    /**
     * Creates an {@link SceneObject} within this SceneModel.
     *
     * Registers the new {@link SceneObject} in {@link SceneModel.objects}.
     *
     * @param objectParams Pre-compressed object parameters.
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    createObject(objectParams: ObjectParams): void {
        if (this.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (this.built) {
            throw new Error("SceneModel already built");
        }
        if (!objectParams) {
            throw new Error("Parameters expected: objectParams");
        }
        if (objectParams.id === null || objectParams.id === undefined) {
            throw new Error("Parameter expected: objectParams.id");
        }
        if (!objectParams.meshIds) {
            throw new Error("Parameter expected: objectParams.meshIds");
        }
        if (objectParams.meshIds.length === 0) {
            this.warn("SceneObject has no meshes - won't create: " + objectParams.id);
            return;
        }
        let objectId = objectParams.id;
        if (this.objects[objectId]) {
            while (this.objects[objectId]) {
                objectId = createUUID();
            }
            this.error("SceneObject already exists with this ID: " + objectParams.id + " - substituting random ID instead: " + objectId);
        }
        const meshIds = objectParams.meshIds;
        const meshes = [];
        for (let meshIdIdx = 0, meshIdLen = meshIds.length; meshIdIdx < meshIdLen; meshIdIdx++) {
            const meshId = meshIds[meshIdIdx];
            const mesh = this.meshes[meshId];
            if (!mesh) {
                this.error("Mesh found: " + meshId);
                continue;
            }
            // TODO
            if (this.#meshUsedByObject[meshId]) {
                this.error(`Mesh ${meshId} already used by another SceneObject - will ignore`);
                continue;
            }
            meshes.push(mesh);
            this.#meshUsedByObject[mesh.id] = true;
        }
        const object = new SceneObject({
            id: objectId,
            meshes
        });
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            mesh.object = object;
        }
        this.objects[objectId] = object;
    }

    /**
     * Builds this SceneModel.
     *
     * Sets {@link SceneModel.built} ````true````.
     *
     * Once built, you cannot add any more components to this SceneModel.
     *
     * @throws {Error} If SceneModel has already been built or destroyed.
     */
    async build() {
        if (this.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (this.built) {
            throw new Error("SceneModel already built");
        }
        this.#removeUnusedTextures();
        await this.#compressTextures();
        this.#flagSolidGeometries();
        this.built = true;
        this.onBuilt.dispatch(this, null);
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

    #compressTextures() {
        // let countTextures = this.texturesList.length;
        // return new Promise((resolve) => {
        //     if (countTextures === 0) {
        //         resolve();
        //         return;
        //     }
        //     for (let i = 0, leni = this.texturesList.length; i < leni; i++) {
        //         const texture = this.texturesList[i];
        //         const encodingOptions = TEXTURE_ENCODING_OPTIONS[texture.channel] || {};
        //
        //         if (texture.src) {
        //
        //             // Texture created with SceneModel#createTexture({ src: ... })
        //
        //             const src = texture.src;
        //             const fileExt = src.split('.').pop();
        //             switch (fileExt) {
        //                 case "jpeg":
        //                 case "jpg":
        //                 case "png":
        //                     load(src, ImageLoader, {
        //                         image: {
        //                             type: "data"
        //                         }
        //                     }).then((imageData) => {
        //                         if (texture.compressed) {
        //                             encode(imageData, KTX2BasisWriter, encodingOptions).then((encodedData) => {
        //                                 const encodedImageData = new Uint8Array(encodedData);
        //                                 texture.imageData = encodedImageData;
        //                                 if (--countTextures <= 0) {
        //                                     resolve();
        //                                 }
        //                             }).catch((err) => {
        //                                 this.error("[SceneModel.build] Failed to encode image: " + err);
        //                                 if (--countTextures <= 0) {
        //                                     resolve();
        //                                 }
        //                             });
        //                         } else {
        //                             texture.imageData = new Uint8Array(1);
        //                             if (--countTextures <= 0) {
        //                                 resolve();
        //                             }
        //                         }
        //                     }).catch((err) => {
        //                         this.error("[SceneModel.build] Failed to load image: " + err);
        //                         if (--countTextures <= 0) {
        //                             resolve();
        //                         }
        //                     });
        //                     break;
        //                 default:
        //                     if (--countTextures <= 0) {
        //                         resolve();
        //                     }
        //                     break;
        //             }
        //         }
        //
        //         if (texture.imageData) {
        //
        //             // Texture created with SceneModel#createTexture({ imageData: ... })
        //
        //             if (texture.compressed) {
        //                 encode(texture.imageData, KTX2BasisWriter, encodingOptions)
        //                     .then((encodedImageData) => {
        //                         texture.imageData = new Uint8Array(encodedImageData);
        //                         if (--countTextures <= 0) {
        //                             resolve();
        //                         }
        //                     }).catch((err) => {
        //                     this.error("[SceneModel.build] Failed to encode image: " + err);
        //                     if (--countTextures <= 0) {
        //                         resolve();
        //                     }
        //                 });
        //             } else {
        //                 texture.imageData = new Uint8Array(1);
        //                 if (--countTextures <= 0) {
        //                     resolve();
        //                 }
        //             }
        //         }
        //     }
        // });
    }

    #flagSolidGeometries() {
        // let maxNumPositions = 0;
        // let maxNumIndices = 0;
        // for (let i = 0, len = this.geometriesList.length; i < len; i++) {
        //     const geometry = this.geometriesList[i];
        //     if (geometry.primitiveType === "triangles") {
        //         if (geometry.positionsQuantized.length > maxNumPositions) {
        //             maxNumPositions = geometry.positionsQuantized.length;
        //         }
        //         if (geometry.indices.length > maxNumIndices) {
        //             maxNumIndices = geometry.indices.length;
        //         }
        //     }
        // }
        // let vertexIndexMapping = new Array(maxNumPositions / 3);
        // let edges = new Array(maxNumIndices);
        // for (let i = 0, len = this.geometriesList.length; i < len; i++) {
        //     const geometry = this.geometriesList[i];
        //     if (geometry.primitiveType === "triangles") {
        //         geometry.solid = isTriangleMeshSolid(geometry.indices, geometry.positionsQuantized, vertexIndexMapping, edges);
        //     }
        // }
    }
}
