import {Component} from "../../viewer/Component";
import * as math from "../../viewer/math/index";
import {Mesh} from './lib/Mesh';
import {FrameContext} from "../WebGLRenderer/FrameContext";
import {WebGLRenderer} from "../WebGLRenderer/WebGLRenderer";
import {Scene} from "../../viewer/scene/Scene";
import {View} from "../../viewer/view/View";
import {Geometry} from "./lib/Geometry";
import {SceneModel} from "../../viewer/scene/SceneModel";
import {DrawFlags} from "../WebGLRenderer/DrawFlags";
import {TextureSet} from "./lib/TextureSet";
import {getScratchMemory, putScratchMemory, ScratchMemory} from "./lib/ScratchMemory";
import {Texture} from "./lib/Texture";
import {Texture2D} from "../lib/Texture2D";
import {Events} from "../../viewer/Events";
import {Transform} from "./lib/Transform";
import {createUUID, loadArraybuffer} from "../../viewer/utils/index";
import {WebGLSceneObject} from "./lib/WebGLSceneObject";
import {TrianglesBatchingLayer} from "./lib/layers/vboBatching/triangles/TrianglesBatchingLayer";
import {LinesBatchingLayer} from "./lib/layers/vboBatching/lines/LinesBatchingLayer";
import {Drawable} from "../WebGLRenderer/Drawable";
import {collapseAABB3, expandAABB3} from "../../viewer/math/boundaries";
import {getKTX2TextureTranscoder} from "../textureTranscoders/KTX2TextureTranscoder/KTX2TextureTranscoder";
import {LinesInstancingLayer} from "./lib/layers/vboInstancing/lines/LinesInstancingLayer";
import {PointsBatchingLayer} from "./lib/layers/vboBatching/points/PointsBatchingLayer";
import {PointsInstancingLayer} from "./lib/layers/vboInstancing/points/PointsInstancingLayer";
import {TrianglesInstancingLayer} from "./lib/layers/vboInstancing/triangles/TrianglesInstancingLayer";

import {
    GeometryParams,
    MeshParams,
    Renderer,
    SceneObjectParams,
    TextureParams,
    TextureSetParams
} from "../../viewer/index";

import {
    ClampToEdgeWrapping,
    LinearEncoding,
    LinearFilter,
    LinearMipmapLinearFilter,
    LinearMipMapNearestFilter,
    LinesPrimitive,
    MirroredRepeatWrapping,
    NearestFilter,
    NearestMipMapLinearFilter,
    NearestMipMapNearestFilter,
    PointsPrimitive,
    RepeatWrapping,
    SolidPrimitive,
    sRGBEncoding,
    SurfacePrimitive,
    TrianglesPrimitive
} from "../../viewer/constants";

const tempVec3a = math.vec3();
const tempMat4 = math.mat4();

const defaultScale = math.vec3([1, 1, 1]);
const defaultPosition = math.vec3([0, 0, 0]);
const defaultRotation = math.vec3([0, 0, 0]);
const defaultQuaternion = math.identityQuaternion();

const defaultColorTextureId = "defaultColorTexture";
const defaultMetalRoughTextureId = "defaultMetalRoughTexture";
const defaultNormalsTextureId = "defaultNormalsTexture";
const defaultEmissiveTextureId = "defaultEmissiveTexture";
const defaultOcclusionTextureId = "defaultOcclusionTexture";
const defaultTextureSetId = "defaultTextureSet";

export class WebGLSceneModel extends Component implements SceneModel, Drawable {

    /**
     * Whether quality rendering is enabled for this WebGLSceneModel.
     *
     * Default is ````true````.
     */
    readonly qualityRender: boolean;
    renderMode?: number;
    declare readonly id: string;
    readonly view: View;
    readonly scene: Scene;
    declare readonly events: Events;
    declare readonly destroyed: boolean;
    sceneObjects: { [key: string]: WebGLSceneObject };
    sceneObjectList: WebGLSceneObject[];
    numPortions: number;
    numVisibleLayerPortions: number;
    numEdgesLayerPortions: number;
    numCulledLayerPortions: number;
    numTransparentLayerPortions: number;
    numHighlightedLayerPortions: number;
    numClippableLayerPortions: number;
    numXRayedLayerPortions: number;
    numSelectedLayerPortions: number;
    numPickableLayerPortions: number;
    drawFlags: DrawFlags;
    #renderer: Renderer;
    #gl: WebGL2RenderingContext;
    #webglRenderer: WebGLRenderer;
    #origin: math.FloatArrayType;
    #position: math.FloatArrayType;
    #rotation: math.FloatArrayType;
    #quaternion: math.FloatArrayType;
    #scale: math.FloatArrayType;
    #worldMatrix: math.FloatArrayType;
    #worldNormalMatrix: math.FloatArrayType;
    #viewMatrix: math.FloatArrayType;
    #viewNormalMatrix: math.FloatArrayType;
    #colorTextureEnabled: boolean;
    #backfaces: boolean;
    #geometries: { [key: string]: Geometry };
    #textures: { [key: string]: Texture };
    #textureSets: { [key: string]: TextureSet };
    #meshes: { [key: string]: Mesh };
    #layerList: any[];
    #numGeometries: number;
    #numTriangles: number;
    #numLines: number;
    #numPoints: number;
    #numSceneObjects: number;
    #textureTranscoder: any;
    #maxGeometryBatchSize: number;
    #aabbDirty: boolean;
    #lastOrigin: math.FloatArrayType;
    #lastPositionsDecompressMatrix: math.FloatArrayType;
    #edgeThreshold: number;
    #instancingLayers: { [key: string]: any };
    #lastPortionHadNormals: boolean;
    #currentBatchingLayers: { [key: string]: any };
    #currentDataTextureLayers: { [key: string]: any };
    #scratchMemory: ScratchMemory;

    #aabb: math.FloatArrayType;

    #viewMatrixDirty: boolean;
    #worldMatrixNonIdentity: boolean;
    #onCameraViewMatrix: number;
    #isModel: any;
    #lastuvsDecompressMatrix: math.FloatArrayType;
    #lastTextureSetId: String;
    #instancingGeometries: {};
    #preparedInstancingGeometries: {};

    constructor(params: {
        id: string;
        matrix?: math.FloatArrayType;
        scale?: math.FloatArrayType;
        view: View;
        scene: Scene;
        webglRenderer: WebGLRenderer;
        quaternion?: math.FloatArrayType;
        rotation?: math.FloatArrayType;
        position?: math.FloatArrayType;
        origin?: math.FloatArrayType;
        edgeThreshold?: number;
        textureTranscoder?: any;
        maxGeometryBatchSize?: number;
        qualityRender?: boolean;
    }) {

        super(params.view);

        this.events = new Events();

        this.id = params.id;
        this.scene = params.scene;
        this.view = params.view;
        this.sceneObjectList = [];
        this.drawFlags = new DrawFlags();

        this.#webglRenderer = params.webglRenderer;
        this.#renderer = params.webglRenderer;
        this.#textureTranscoder = params.textureTranscoder || getKTX2TextureTranscoder(this.viewer);
        this.#maxGeometryBatchSize = params.maxGeometryBatchSize;
        this.#aabb = collapseAABB3();
        this.#aabbDirty = false;
        this.#layerList = []; // For GL state efficiency when drawing, InstancingLayers are in first part, BatchingLayers are in second
        this.#lastOrigin = null;
        this.#lastPositionsDecompressMatrix = null;
        this.#lastPortionHadNormals = null;
        this.#instancingLayers = {};
        this.#currentBatchingLayers = {};
        this.#currentDataTextureLayers = {};
        this.#scratchMemory = getScratchMemory();
        this.#geometries = {};
        this.#textures = {};
        this.#textureSets = {};
        this.#meshes = {};
        this.#numGeometries = 0; // Number of geometries created with createGeometry()

        // These counts are used to avoid unnecessary render passes
        // They are incremented or decremented exclusively by BatchingLayer and InstancingLayer

        this.numPortions = 0;
        this.numVisibleLayerPortions = 0;
        this.numTransparentLayerPortions = 0;
        this.numXRayedLayerPortions = 0;
        this.numHighlightedLayerPortions = 0;
        this.numSelectedLayerPortions = 0;
        this.numEdgesLayerPortions = 0;
        this.numPickableLayerPortions = 0;
        this.numClippableLayerPortions = 0;
        this.numCulledLayerPortions = 0;

        this.#numSceneObjects = 0;

        this.#numTriangles = 0;
        this.#numLines = 0;
        this.#numPoints = 0;
        this.#edgeThreshold = params.edgeThreshold || 10;

        // Build static matrix

        this.#origin = math.vec3(params.origin || [0, 0, 0]);
        this.#position = math.vec3(params.position || [0, 0, 0]);
        this.#rotation = math.vec3(params.rotation || [0, 0, 0]);
        this.#quaternion = math.vec4(params.quaternion || [0, 0, 0, 1]);
        if (params.rotation) {
            math.eulerToQuaternion(this.#rotation, "XYZ", this.#quaternion);
        }
        this.#scale = math.vec3(params.scale || [1, 1, 1]);
        this.#worldMatrix = math.mat4();
        math.composeMat4(this.#position, this.#quaternion, this.#scale, this.#worldMatrix);
        this.#worldNormalMatrix = math.mat4();
        math.inverseMat4(this.#worldMatrix, this.#worldNormalMatrix);
        math.transposeMat4(this.#worldNormalMatrix);

        if (params.matrix || params.position || params.rotation || params.scale || params.quaternion) {
            this.#viewMatrix = math.mat4();
            this.#viewNormalMatrix = math.mat4();
            this.#viewMatrixDirty = true;
            this.#worldMatrixNonIdentity = true;
        }

        this.qualityRender = (params.qualityRender !== false);

        this.#onCameraViewMatrix = this.view.camera.events.on("matrix", () => {
            this.#viewMatrixDirty = true;
        });

        this.#createDefaultTextureSet();
    }

    get origin(): math.FloatArrayType {
        return this.#origin;
    }

    get position(): math.FloatArrayType {
        return this.#position;
    }

    get rotation(): math.FloatArrayType {
        return this.#rotation;
    }

    get quaternion(): math.FloatArrayType {
        return this.#quaternion;
    }

    get scale(): math.FloatArrayType {
        return this.#scale;
    }

    get worldMatrix(): math.FloatArrayType {
        return this.#worldMatrix;
    }

    get worldNormalMatrix(): math.FloatArrayType {
        return this.#worldNormalMatrix;
    }

    get viewMatrix(): math.FloatArrayType {
        if (!this.#viewMatrix) {
            return this.view.camera.viewMatrix;
        }
        if (this.#viewMatrixDirty) {
            math.mulMat4(this.view.camera.viewMatrix, this.#worldMatrix, this.#viewMatrix);
            math.inverseMat4(this.#viewMatrix, this.#viewNormalMatrix);
            math.transposeMat4(this.#viewNormalMatrix);
            this.#viewMatrixDirty = false;
        }
        return this.#viewMatrix;
    }

    get viewNormalMatrix(): math.FloatArrayType {
        if (!this.#viewNormalMatrix) {
            return this.view.camera.viewNormalMatrix;
        }
        if (this.#viewMatrixDirty) {
            math.mulMat4(this.view.camera.viewMatrix, this.#worldMatrix, this.#viewMatrix);
            math.inverseMat4(this.#viewMatrix, this.#viewNormalMatrix);
            math.transposeMat4(this.#viewNormalMatrix);
            this.#viewMatrixDirty = false;
        }
        return this.#viewNormalMatrix;
    }

    get colorTextureEnabled() {
        return this.#colorTextureEnabled;
    }

    get backfaces(): boolean {
        return this.#backfaces;
    }

    set backfaces(backfaces: boolean) {
        backfaces = !!backfaces;
        this.#backfaces = backfaces;
        this.#renderer.setImageDirty();
    }

    get matrix(): math.FloatArrayType {
        return this.#worldMatrix;
    }

    get aabb(): math.FloatArrayType {
        if (this.#aabbDirty) {
            this.#rebuildAABB();
        }
        return this.#aabb;
    }

    get numTriangles(): number {
        return this.#numTriangles;
    }

    get numLines(): number {
        return this.#numLines;
    }

    get numPoints(): number {
        return this.#numPoints;
    }

    setVisible(viewIndex: number, visible: boolean) :void{
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setVisible(viewIndex, visible);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setXRayed(viewIndex: number, xrayed: boolean) :void{
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setXRayed(viewIndex, xrayed);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setHighlighted(viewIndex: number, highlighted: boolean) :void{
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setHighlighted(viewIndex, highlighted);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setSelected(viewIndex: number, selected: boolean) :void{
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setSelected(viewIndex, selected);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setEdges(viewIndex: number, edges: boolean) :void{
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setEdges(viewIndex, edges);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setCulled(viewIndex: number, culled: boolean) :void{
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setCulled(viewIndex, culled);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setClippable(viewIndex: number, clippable: boolean) {
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setClippable(viewIndex, clippable);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setCollidable(viewIndex: number, collidable: boolean) {
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setCollidable(viewIndex, collidable);
        }
    }

    setPickable(viewIndex: number, pickable: boolean) {
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setPickable(viewIndex, pickable);
        }
    }

    setColorize(viewIndex: number, colorize: math.FloatArrayType) {
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setColorize(viewIndex, colorize);
        }
    }

    setOpacity(viewIndex: number, opacity: number) {
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setOpacity(viewIndex, opacity);
        }
    }

    setCastsShadow(viewIndex: number, castsShadow: boolean) {
        // castsShadow = (castsShadow !== false);
        // if (castsShadow !== this.#castsShadow) {
        //     this.#castsShadow = castsShadow;
        //     this.#renderer.setImageDirty(viewIndex);
        // }
    }

    setReceivesShadow(viewIndex: number, receivesShadow: number) {
        // receivesShadow = (receivesShadow !== false);
        // if (receivesShadow !== this.#receivesShadow) {
        //     this.#receivesShadow = receivesShadow;
        //     this.#renderer.setImageDirty(viewIndex);
        // }
    }

    getPickViewMatrix(pickViewMatrix: math.FloatArrayType) {
        if (!this.#viewMatrix) {
            return pickViewMatrix;
        }
        return this.#viewMatrix;
    }

    createTransform(params: {
        id: string,
        parentTransformId?: string,
        matrix: math.FloatArrayType,
    }): Transform {
        return null;
    }

    createGeometry(params: GeometryParams): void {
        const geometryId = params.id;
        if (geometryId === undefined || geometryId === null) {
            this.scene.error("Config missing: id");
            return;
        }
        if (this.#geometries[geometryId]) {
            this.scene.error(`Geometry with this ID already created: ${geometryId}`);
            return;
        }
        const primitive = params.primitive;
        if (primitive === undefined || primitive === null) {
            this.scene.error("Param expected: primitive");
            return;
        }
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            this.scene.error(`Unsupported value for 'primitive': '${primitive}'`);
            return;
        }
        if (!params.positions && !params.positionsCompressed) {
            this.scene.error("Param expected: `positions` or `positionsCompressed'");
            return null;
        }
        if (params.positionsCompressed && !params.positionsDecompressMatrix) {
            this.scene.error("Param expected: `positionsDecompressMatrix` (required for `positionsCompressed')");
            return null;
        }
        if (params.uvsCompressed && !params.uvsDecompressMatrix) {
            this.scene.error("Param expected: `uvsDecompressMatrix` (required for `uvsCompressed')");
            return null;
        }
        if (!params.indices && primitive !== PointsPrimitive) {
            this.scene.error(`Param expected: indices (required for primitive type)`);
            return null;
        }
        const geometry = new Geometry(this.#webglRenderer.gl, params);
        this.#geometries[geometryId] = geometry;
        if (primitive === TrianglesPrimitive || primitive === SolidPrimitive || primitive !== SurfacePrimitive) {
            this.#numTriangles += (params.indices ? Math.round(params.indices.length / 3) : 0);
        }
        this.#numGeometries++;
    }

    createTexture(params: TextureParams): void {
        const textureId = params.id;
        if (textureId === undefined || textureId === null) {
            this.scene.error("Config missing: id");
            return;
        }
        if (this.#textures[textureId]) {
            this.scene.error("Texture already created: " + textureId);
            return;
        }
        if (!params.src && !params.image && !params.buffers) {
            this.scene.error("Param expected: `src`, `image' or 'buffers'");
            return null;
        }
        let minFilter = params.minFilter || LinearMipmapLinearFilter;
        if (minFilter !== LinearFilter &&
            minFilter !== LinearMipMapNearestFilter &&
            minFilter !== LinearMipmapLinearFilter &&
            minFilter !== NearestMipMapLinearFilter &&
            minFilter !== NearestMipMapNearestFilter) {
            this.scene.error(`[createTexture] Unsupported value for 'minFilter' - 
            supported values are LinearFilter, LinearMipMapNearestFilter, NearestMipMapNearestFilter, 
            NearestMipMapLinearFilter and LinearMipmapLinearFilter. Defaulting to LinearMipmapLinearFilter.`);
            minFilter = LinearMipmapLinearFilter;
        }
        let magFilter = params.magFilter || LinearFilter;
        if (magFilter !== LinearFilter && magFilter !== NearestFilter) {
            this.scene.error(`[createTexture] Unsupported value for 'magFilter' - supported values are LinearFilter and NearestFilter. Defaulting to LinearFilter.`);
            magFilter = LinearFilter;
        }
        let wrapS = params.wrapS || RepeatWrapping;
        if (wrapS !== ClampToEdgeWrapping && wrapS !== MirroredRepeatWrapping && wrapS !== RepeatWrapping) {
            this.scene.error(`[createTexture] Unsupported value for 'wrapS' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapS = RepeatWrapping;
        }
        let wrapT = params.wrapT || RepeatWrapping;
        if (wrapT !== ClampToEdgeWrapping && wrapT !== MirroredRepeatWrapping && wrapT !== RepeatWrapping) {
            this.scene.error(`[createTexture] Unsupported value for 'wrapT' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapT = RepeatWrapping;
        }
        let wrapR = params.wrapR || RepeatWrapping;
        if (wrapR !== ClampToEdgeWrapping && wrapR !== MirroredRepeatWrapping && wrapR !== RepeatWrapping) {
            this.scene.error(`[createTexture] Unsupported value for 'wrapR' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapR = RepeatWrapping;
        }
        let encoding = params.encoding || LinearEncoding;
        if (encoding !== LinearEncoding && encoding !== sRGBEncoding) {
            this.scene.error("[createTexture] Unsupported value for 'encoding' - supported values are LinearEncoding and sRGBEncoding. Defaulting to LinearEncoding.");
            encoding = LinearEncoding;
        }
        const texture = new Texture2D({gl: this.#webglRenderer.gl});
        if (params.preloadColor) {
            texture.setPreloadColor(params.preloadColor);
        }
        if (params.image) { // Ignore transcoder for Images
            const image = params.image;
            image.crossOrigin = "Anonymous";
            texture.setImage(image, {minFilter, magFilter, wrapS, wrapT, wrapR, flipY: params.flipY, encoding});

        } else if (params.src) {
            const ext = params.src.split('.').pop();
            switch (ext) { // Don't transcode recognized image file types
                case "jpeg":
                case "jpg":
                case "png":
                case "gif":
                    const image = new Image();
                    image.onload = () => {
                        texture.setImage(image, {
                            minFilter,
                            magFilter,
                            wrapS,
                            wrapT,
                            wrapR,
                            flipY: params.flipY,
                            encoding
                        });
                    };
                    image.src = params.src; // URL or Base64 string
                    break;
                default: // Assume other file types need transcoding
                    if (!this.#textureTranscoder) {
                        this.scene.error(`Can't create texture from 'src' - VBOSceneModel needs to be configured with a TextureTranscoder for this file type ('${ext}')`);
                    } else {
                        loadArraybuffer(params.src, (arrayBuffer: ArrayBuffer) => {
                                if (!arrayBuffer.byteLength) {
                                    this.scene.error(`Can't create texture from 'src': file data is zero length`);
                                    return;
                                }
                                this.#textureTranscoder.transcode([arrayBuffer], texture).then(() => {
                                    this.#renderer.setImageDirty();
                                });
                            },
                            (errMsg: string) => {
                                this.scene.error(`Can't create texture from 'src': ${errMsg}`);
                            });
                    }
                    break;
            }
        } else if (params.buffers) { // Buffers implicitly require transcoding
            if (!this.#textureTranscoder) {
                this.scene.error(`Can't create texture from 'buffers' - VBOSceneModel needs to be configured with a TextureTranscoder for this option`);
            } else {
                this.#textureTranscoder.transcode(params.buffers, texture).then(() => {
                    this.#renderer.setImageDirty();
                });
            }
        }
        this.#textures[textureId] = new Texture({id: textureId, texture});
    }

    createTextureSet(params: TextureSetParams) {
        const textureSetId = params.id;
        if (textureSetId === undefined || textureSetId === null) {
            this.scene.error("Config missing: id");
            return;
        }
        if (this.#textureSets[textureSetId]) {
            this.scene.error(`Texture set already created: ${textureSetId}`);
            return;
        }
        let colorTexture;
        if (params.colorTextureId !== undefined && params.colorTextureId !== null) {
            colorTexture = this.#textures[params.colorTextureId];
            if (!colorTexture) {
                this.scene.error(`Texture not found: ${params.colorTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            colorTexture = this.#textures[defaultColorTextureId];
        }
        let metallicRoughnessTexture;
        if (params.metallicRoughnessTextureId !== undefined && params.metallicRoughnessTextureId !== null) {
            metallicRoughnessTexture = this.#textures[params.metallicRoughnessTextureId];
            if (!metallicRoughnessTexture) {
                this.scene.error(`Texture not found: ${params.metallicRoughnessTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            metallicRoughnessTexture = this.#textures[defaultMetalRoughTextureId];
        }
        let normalsTexture;
        if (params.normalsTextureId !== undefined && params.normalsTextureId !== null) {
            normalsTexture = this.#textures[params.normalsTextureId];
            if (!normalsTexture) {
                this.scene.error(`Texture not found: ${params.normalsTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            normalsTexture = this.#textures[defaultNormalsTextureId];
        }
        let emissiveTexture;
        if (params.emissiveTextureId !== undefined && params.emissiveTextureId !== null) {
            emissiveTexture = this.#textures[params.emissiveTextureId];
            if (!emissiveTexture) {
                this.scene.error(`Texture not found: ${params.emissiveTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            emissiveTexture = this.#textures[defaultEmissiveTextureId];
        }
        let occlusionTexture;
        if (params.occlusionTextureId !== undefined && params.occlusionTextureId !== null) {
            occlusionTexture = this.#textures[params.occlusionTextureId];
            if (!occlusionTexture) {
                this.scene.error(`Texture not found: ${params.occlusionTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            occlusionTexture = this.#textures[defaultOcclusionTextureId];
        }
        const textureSet = new TextureSet({
            id: textureSetId,
            colorTexture,
            metallicRoughnessTexture,
            normalsTexture,
            emissiveTexture,
            occlusionTexture
        });
        this.#textureSets[textureSetId] = textureSet;
    }

    createMesh(params: MeshParams): void {

        let id = params.id;
        if (id === undefined || id === null) {
            this.error("Config missing: id");
            return;
        }

        if (this.#meshes[id]) {
            this.error(`VBOSceneModel already has a mesh with this ID: ${id}`);
            return;
        }

        const geometryId = params.geometryId;
        const sharingGeometry = (params.geometryId !== undefined);
        if (sharingGeometry && !this.#geometries[params.geometryId]) {
            this.error(`Geometry not found: ${params.geometryId} - ensure that you create it first with createGeometry()`);
            return;
        }

        const textureSetId = params.textureSetId || defaultTextureSetId;
        if (textureSetId) {
            if (!this.#textureSets[textureSetId]) {
                this.error(`Texture set not found: ${textureSetId} - ensure that you create it first with createTextureSet()`);
                return;
            }
        }

        let portionId;

        const color = (params.color) ? new Uint8Array([Math.floor(params.color[0] * 255), Math.floor(params.color[1] * 255), Math.floor(params.color[2] * 255)]) : [255, 255, 255];
        const opacity = (params.opacity !== undefined && params.opacity !== null) ? Math.floor(params.opacity * 255) : 255;
        const metallic = (params.metallic !== undefined && params.metallic !== null) ? Math.floor(params.metallic * 255) : 0;
        const roughness = (params.roughness !== undefined && params.roughness !== null) ? Math.floor(params.roughness * 255) : 255;

        const mesh = new Mesh({
            webglRenderer: this.#webglRenderer,
            id,
            color,
            opacity
        });

        const pickId = mesh.pickId;

        const a = pickId >> 24 & 0xFF;
        const b = pickId >> 16 & 0xFF;
        const g = pickId >> 8 & 0xFF;
        const r = pickId & 0xFF;

        const pickColor = new Uint8Array([r, g, b, a]); // Quantized pick color

        collapseAABB3(mesh.aabb);

        let layer;

        if (sharingGeometry) {

            let meshMatrix;
            let worldMatrix = this.#worldMatrixNonIdentity ? this.#worldMatrix : null;

            if (params.matrix) {
                meshMatrix = params.matrix;
            } else {
                const scale = params.scale || defaultScale;
                const position = params.position || defaultPosition;
                const rotation = params.rotation || defaultRotation;
                math.eulerToQuaternion(rotation, "XYZ", defaultQuaternion);
                meshMatrix = math.composeMat4(position, defaultQuaternion, scale, tempMat4);
            }

            const origin = (params.origin) ? math.addVec3(this.#origin, params.origin, tempVec3a) : this.#origin;
            const instancingLayer = this.#getInstancingLayer(origin, textureSetId, geometryId);

            layer = instancingLayer;

            portionId = instancingLayer.createPortion({
                color: color,
                metallic: metallic,
                roughness: roughness,
                opacity: opacity,
                meshMatrix: meshMatrix,
                worldMatrix: worldMatrix,
                aabb: mesh.aabb,
                pickColor: pickColor
            });
            this.numPortions++;

            const numTriangles = Math.round(instancingLayer.numIndices / 3);
            this.#numTriangles += numTriangles;
            mesh.numTriangles = numTriangles;

            mesh.origin = origin;

        } else { // Batching

            let primitive = params.primitive;
            if (primitive === undefined || primitive === null) {
                primitive = TrianglesPrimitive;
            }
            if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
                this.error(`Unsupported value for 'primitive': '${primitive}'  ('geometryId' is absent) - supported values are 'points', 'lines', 'triangles', 'solid' and 'surface'.`);
                return;
            }
            if (!params.positions && !params.positionsCompressed) {
                this.error("Param expected: 'positions' or 'positionsCompressed'  ('geometryId' is absent)");
                return null;
            }
            if (params.positions && params.positionsCompressed) {
                this.error("Only one param expected, not both: 'positions' or 'positionsCompressed' ('geometryId' is absent)");
                return null;
            }
            if (params.positionsCompressed && !params.positionsDecompressMatrix) {
                this.error("Param expected: 'positionsDecompressMatrix' (required for 'positionsCompressed'; 'geometryId' is absent)");
                return null;
            }
            if (params.uvsCompressed && !params.uvsDecompressMatrix) {
                this.error("Param expected: `uvsDecompressMatrix` (required for `uvsCompressed'; 'geometryId' is absent)");
                return null;
            }
            if (!params.indices && primitive !== PointsPrimitive) {
                this.error(`Param expected: indices (required for '${primitive}' primitive type)`);
                return null;
            }
            if (!params.indices && primitive !== PointsPrimitive) {
                this.error("Config expected: indices (no meshIds provided, so expecting geometry arrays instead)");
                return null;
            }

            let indices = params.indices;
            let edgeIndices = params.edgeIndices;
            let origin = params.origin ? math.addVec3(this.#origin, params.origin, tempVec3a) : this.#origin;
            let positions = params.positions;

            if (positions) {
                const rtcCenter = math.vec3();
                const rtcPositions: number[] = [];
                const rtcNeeded = math.rtc.worldToRTCPositions(positions, rtcPositions, rtcCenter);
                if (rtcNeeded) {
                    positions = rtcPositions;
                    origin = math.addVec3(origin, rtcCenter, rtcCenter);
                }
            }

            let needNewBatchingLayers = false;

            if (!this.#lastOrigin) {
                needNewBatchingLayers = true;
                this.#lastOrigin = math.vec3(origin);
            } else {
                if (!math.compareVec3(this.#lastOrigin, origin)) {
                    needNewBatchingLayers = true;
                    // @ts-ignore
                    this.#lastOrigin.set(origin);
                }
            }
            if (params.positionsDecompressMatrix) {
                if (!this.#lastPositionsDecompressMatrix) {
                    needNewBatchingLayers = true;
                    this.#lastPositionsDecompressMatrix = math.mat4(params.positionsDecompressMatrix);

                } else {
                    if (!math.compareMat4(this.#lastPositionsDecompressMatrix, params.positionsDecompressMatrix)) {
                        needNewBatchingLayers = true;
                        // @ts-ignore
                        this.#lastPositionsDecompressMatrix.set(params.positionsDecompressMatrix)
                    }
                }
            }
            if (params.uvsDecompressMatrix) {
                if (!this.#lastuvsDecompressMatrix) {
                    needNewBatchingLayers = true;
                    this.#lastuvsDecompressMatrix = math.mat4(params.uvsDecompressMatrix);

                } else {
                    if (!math.compareMat4(this.#lastuvsDecompressMatrix, params.uvsDecompressMatrix)) {
                        needNewBatchingLayers = true;
                        // @ts-ignore
                        this.#lastuvsDecompressMatrix.set(params.uvsDecompressMatrix)
                    }
                }
            }
            if (params.textureSetId) {
                if (this.#lastTextureSetId !== params.textureSetId) {
                    needNewBatchingLayers = true;
                    this.#lastTextureSetId = params.textureSetId;
                }
            }
            if (needNewBatchingLayers) {
                for (let prim in this.#currentBatchingLayers) {
                    if (this.#currentBatchingLayers.hasOwnProperty(prim)) {
                        this.#currentBatchingLayers[prim].finalize();
                    }
                }
                this.#currentBatchingLayers = {};
            }

            const normalsProvided = (!!params.normals && params.normals.length > 0);
            if (primitive === TrianglesPrimitive || primitive === SolidPrimitive || primitive === SurfacePrimitive) {
                if (this.#lastPortionHadNormals !== null && normalsProvided !== this.#lastPortionHadNormals) {
                    [TrianglesPrimitive, SolidPrimitive, SurfacePrimitive].map(primitiveId => {
                        if (this.#currentBatchingLayers[primitiveId]) {
                            this.#currentBatchingLayers[primitiveId].finalize();
                            delete this.#currentBatchingLayers[primitiveId];
                        }
                    });
                }
                this.#lastPortionHadNormals = normalsProvided;
            }

            const worldMatrix = this.#worldMatrixNonIdentity ? this.#worldMatrix : null;
            let meshMatrix;

            if (!params.positionsDecompressMatrix) {
                if (params.matrix) {
                    meshMatrix = params.matrix;
                } else {
                    const scale = params.scale || defaultScale;
                    const position = params.position || defaultPosition;
                    const rotation = params.rotation || defaultRotation;
                    math.eulerToQuaternion(rotation, "XYZ", defaultQuaternion);
                    meshMatrix = math.composeMat4(position, defaultQuaternion, scale, tempMat4);
                }
            }

            const textureSet = textureSetId ? this.#textureSets[textureSetId] : null;

            layer = this.#currentBatchingLayers[primitive];

            const lenPositions = (positions || params.positionsCompressed).length;

            switch (primitive) {
                case TrianglesPrimitive:
                case SolidPrimitive:
                case SurfacePrimitive:
                    if (layer) {
                        if (!layer.canCreatePortion(lenPositions, indices.length)) {
                            layer.finalize();
                            delete this.#currentBatchingLayers[primitive];
                            layer = null;
                        }
                    }
                    if (!layer) {
                        layer = new TrianglesBatchingLayer({
                            sceneModel: this,
                            textureSet: textureSet,
                            layerIndex: 0, // This is set in #finalize()
                            scratchMemory: this.#scratchMemory,
                            positionsDecompressMatrix: params.positionsDecompressMatrix,  // Can be undefined
                            uvsDecompressMatrix: params.uvsDecompressMatrix, // Can be undefined
                            origin,
                            maxGeometryBatchSize: this.#maxGeometryBatchSize,
                            solid: (primitive === SolidPrimitive),
                            autoNormals: (!normalsProvided)
                        });
                        this.#layerList.push(layer);
                        this.#currentBatchingLayers[primitive] = layer;
                    }
                    if (!edgeIndices) {
                        edgeIndices = math.geometry.buildEdgeIndices(positions || params.positionsCompressed, indices, null, this.#edgeThreshold);
                    }
                    portionId = layer.createPortion({
                        positions: positions,
                        positionsCompressed: params.positionsCompressed,
                        normals: params.normals,
                        normalsCompressed: params.normalsCompressed,
                        colors: params.colors,
                        colorsCompressed: params.colorsCompressed,
                        uvs: params.uvs,
                        uvsCompressed: params.uvsCompressed,
                        indices: indices,
                        edgeIndices: edgeIndices,
                        color: color,
                        opacity: opacity,
                        metallic: metallic,
                        roughness: roughness,
                        meshMatrix: meshMatrix,
                        worldMatrix: worldMatrix,
                        worldAABB: mesh.aabb,
                        pickColor: pickColor
                    });
                    this.numPortions++;
                    const numTriangles = Math.round(indices.length / 3);
                    this.#numTriangles += numTriangles;
                    mesh.numTriangles = numTriangles;
                    break;

                case LinesPrimitive:
                    if (layer) {
                        if (!layer.canCreatePortion(lenPositions, indices.length)) {
                            layer.finalize();
                            delete this.#currentBatchingLayers[primitive];
                            layer = null;
                        }
                    }
                    if (!layer) {
                        layer = new LinesBatchingLayer({
                            sceneModel: this,
                            layerIndex: 0, // This is set in #finalize()
                            scratchMemory: this.#scratchMemory,
                            positionsDecompressMatrix: params.positionsDecompressMatrix,  // Can be undefined
                            origin,
                            maxGeometryBatchSize: this.#maxGeometryBatchSize
                        });
                        this.#layerList.push(layer);
                        this.#currentBatchingLayers[primitive] = layer;
                    }
                    portionId = layer.createPortion({
                        positions: positions,
                        positionsCompressed: params.positionsCompressed,
                        indices: indices,
                        colors: params.colors,
                        colorsCompressed: params.colorsCompressed,
                        color: color,
                        opacity: opacity,
                        meshMatrix: meshMatrix,
                        worldMatrix: worldMatrix,
                        worldAABB: mesh.aabb,
                        pickColor: pickColor
                    });
                    this.numPortions++;
                    this.#numLines += Math.round(indices.length / 2);
                    break;

                case PointsPrimitive:
                    if (layer) {
                        if (!layer.canCreatePortion(lenPositions)) {
                            layer.finalize();
                            delete this.#currentBatchingLayers[primitive];
                            layer = null;
                        }
                    }
                    if (!layer) {
                        layer = new PointsBatchingLayer({
                            sceneModel: this,
                            layerIndex: 0, // This is set in #finalize()
                            scratchMemory: this.#scratchMemory,
                            positionsDecompressMatrix: params.positionsDecompressMatrix,  // Can be undefined
                            origin,
                            maxGeometryBatchSize: this.#maxGeometryBatchSize
                        });
                        this.#layerList.push(layer);
                        this.#currentBatchingLayers[primitive] = layer;
                    }
                    portionId = layer.createPortion({
                        positions: positions,
                        positionsCompressed: params.positionsCompressed,
                        colors: params.colors,
                        colorsCompressed: params.colorsCompressed,
                        color: color,
                        opacity: opacity,
                        meshMatrix: meshMatrix,
                        worldMatrix: worldMatrix,
                        worldAABB: mesh.aabb,
                        pickColor: pickColor
                    });
                    this.numPortions++;
                    this.#numPoints += Math.round(lenPositions / 3);
                    break;
            }


            this.#numGeometries++;
            mesh.origin = origin;
        }
        // else
        //     {
        //         // Data textures
        //     }

        expandAABB3(this.#aabb, mesh.aabb);

        mesh.sceneObject = null; // Will be set within PerformanceModelNode constructor
        mesh.layer = layer;
        mesh.portionId = portionId;

        this.#meshes[id] = mesh;
    }

    createSceneObject(params: SceneObjectParams) {
        let id = params.id;
        if (id === undefined) {
            id = createUUID();
        } else if (this.sceneObjects[id]) {
            this.error("SceneModel already has a SceneObject with this ID: " + id + " - will assign random ID");
            id = createUUID();
        }
        const meshIds = params.meshIds;
        if (meshIds === undefined) {
            this.error("Config missing: meshIds");
            return;
        }
        let meshes = [];
        for (let i = 0, len = meshIds.length; i < len; i++) {
            const meshId = meshIds[i];
            const mesh = this.#meshes[meshId];
            if (!mesh) {
                this.error("Mesh with this ID not found: " + meshId + " - ignoring this mesh");
                continue;
            }
            if (mesh.sceneObject) {
                this.error("Mesh with ID " + meshId + " already belongs to object with ID " + mesh.sceneObject.id + " - ignoring this mesh");
                continue;
            }
            meshes.push(mesh);
        }
        let aabb;
        if (meshes.length === 1) {
            aabb = meshes[0].aabb;
        } else {
            aabb = collapseAABB3();
            for (let i = 0, len = meshes.length; i < len; i++) {
                expandAABB3(aabb, meshes[i].aabb);
            }
        }
        const sceneObject = new WebGLSceneObject({
            id,
            sceneModel: this,
            meshes,
            aabb
        });
        this.sceneObjectList.push(sceneObject);
        this.sceneObjects[id] = sceneObject;
        this.#numSceneObjects++;
        return sceneObject;
    }

    finalize() {

        if (this.destroyed) {
            return;
        }

        for (const layerId in this.#instancingLayers) {
            if (this.#instancingLayers.hasOwnProperty(layerId)) {
                this.#instancingLayers[layerId].finalize();
            }
        }

        for (let layerId in this.#currentBatchingLayers) {
            if (this.#currentBatchingLayers.hasOwnProperty(layerId)) {
                this.#currentBatchingLayers[layerId].finalize();
            }
        }
        this.#currentBatchingLayers = {};

        for (let layerId in this.#currentDataTextureLayers) {
            if (this.#currentDataTextureLayers.hasOwnProperty(layerId)) {
                this.#currentDataTextureLayers[layerId].finalize();
            }
        }
        this.#currentDataTextureLayers = {};

        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            const sceneObject = this.sceneObjectList[i];
            sceneObject.finalize();
        }

        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            const sceneObject = this.sceneObjectList[i];
            sceneObject.finalize2();
        }

        this.#layerList.sort((a, b) => {
            if (a.sortId < b.sortId) {
                return -1;
            }
            if (a.sortId > b.sortId) {
                return 1;
            }
            return 0;
        });

        for (let i = 0, len = this.#layerList.length; i < len; i++) {
            const layer = this.#layerList[i];
            layer.layerIndex = i;
        }

        this.#instancingGeometries = {};
        this.#preparedInstancingGeometries = {};

        this.#renderer.setImageDirty();

        this.scene.setAABBDirty();

        this.events.fire("finalized", {});
    }

    rebuildDrawFlags() {
        this.drawFlags.reset();
        this.#updateDrawFlagsVisibleLayers();
        if (this.drawFlags.numLayers > 0 && this.drawFlags.numVisibleLayers === 0) {
            this.drawFlags.culled = true;
            return;
        }
        this.#updateDrawFlags();
    }

    drawColorOpaque(frameContext: FrameContext): void {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawColorOpaque(drawFlags, frameContext);
        }
    }

    drawColorTransparent(frameContext: FrameContext): void {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawColorTransparent(drawFlags, frameContext);
        }
    }

    drawDepth(frameContext: FrameContext): void { // Dedicated to SAO because it skips transparent objects
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawDepth(drawFlags, frameContext);
        }
    }

    drawNormals(frameContext: FrameContext): void { // Dedicated to SAO because it skips transparent objects
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawNormals(drawFlags, frameContext);
        }
    }

    drawSilhouetteXRayed(frameContext: FrameContext): void {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawSilhouetteXRayed(drawFlags, frameContext);
        }
    }

    drawSilhouetteHighlighted(frameContext: FrameContext): void {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawSilhouetteHighlighted(drawFlags, frameContext);
        }
    }

    drawSilhouetteSelected(frameContext: FrameContext): void {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawSilhouetteSelected(drawFlags, frameContext);
        }
    }

    drawEdgesColorOpaque(frameContext: FrameContext): void {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesColorOpaque(drawFlags, frameContext);
        }
    }

    drawEdgesColorTransparent(frameContext: FrameContext): void {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesColorTransparent(drawFlags, frameContext);
        }
    }

    drawEdgesXRayed(frameContext: FrameContext): void {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesXRayed(drawFlags, frameContext);
        }
    }

    drawEdgesHighlighted(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesHighlighted(drawFlags, frameContext);
        }
    }

    drawEdgesSelected(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesSelected(drawFlags, frameContext);
        }
    }

    drawOcclusion(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawOcclusion(drawFlags, frameContext);
        }
    }

    drawShadow(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawShadow(drawFlags, frameContext);
        }
    }

    drawPickMesh(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawPickMesh(drawFlags, frameContext);
        }
    }

    drawPickDepths(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawPickDepths(drawFlags, frameContext);
        }
    }

    drawPickNormals(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawPickNormals(drawFlags, frameContext);
        }
    }

    destroy() {

        this.events.fire("destroyed", {}); // Fire this first

        this.view.camera.events.off(this.#onCameraViewMatrix);

        for (let layerId in this.#currentBatchingLayers) {
            if (this.#currentBatchingLayers.hasOwnProperty(layerId)) {
                this.#currentBatchingLayers[layerId].destroy();
            }
        }

        for (let layerId in this.#currentDataTextureLayers) {
            if (this.#currentDataTextureLayers.hasOwnProperty(layerId)) {
                this.#currentDataTextureLayers[layerId].destroy();
            }
        }

        for (let i = 0, len = this.#layerList.length; i < len; i++) {
            this.#layerList[i].destroy();
        }

        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].destroy();
        }

        Object.entries(this.#geometries).forEach(([key, geometry]) => {
            geometry.destroy();
        });

        this.#currentBatchingLayers = {};
        this.#currentDataTextureLayers = {};
        this.#geometries = {};
        this.#textures = {};
        this.#textureSets = {};
        this.#meshes = {};
        this.sceneObjects = {};

        this.scene.setAABBDirty();

        putScratchMemory();

        super.destroy();
    }

    #createDefaultTextureSet() {
        const defaultColorTexture = new Texture({
            id: defaultColorTextureId,
            texture: new Texture2D({
                gl: this.#webglRenderer.gl,
                preloadColor: [1, 1, 1, 1] // [r, g, b, a]})
            })
        });
        const defaultMetalRoughTexture = new Texture({
            id: defaultMetalRoughTextureId,
            texture: new Texture2D({
                gl: this.#webglRenderer.gl,
                preloadColor: [0, 1, 1, 1] // [unused, roughness, metalness, unused]
            })
        });
        const defaultNormalsTexture = new Texture({
            id: defaultNormalsTextureId,
            texture: new Texture2D({
                gl: this.#webglRenderer.gl,
                preloadColor: [0, 0, 0, 0] // [x, y, z, unused] - these must be zeros
            })
        });
        const defaultEmissiveTexture = new Texture({
            id: defaultEmissiveTextureId,
            texture: new Texture2D({
                gl: this.#webglRenderer.gl,
                preloadColor: [0, 0, 0, 1] // [x, y, z, unused]
            })
        });
        const defaultOcclusionTexture = new Texture({
            id: defaultOcclusionTextureId,
            texture: new Texture2D({
                gl: this.#webglRenderer.gl,
                preloadColor: [1, 1, 1, 1] // [x, y, z, unused]
            })
        });
        this.#textures[defaultColorTextureId] = defaultColorTexture;
        this.#textures[defaultMetalRoughTextureId] = defaultMetalRoughTexture;
        this.#textures[defaultNormalsTextureId] = defaultNormalsTexture;
        this.#textures[defaultEmissiveTextureId] = defaultEmissiveTexture;
        this.#textures[defaultOcclusionTextureId] = defaultOcclusionTexture;
        this.#textureSets[defaultTextureSetId] = new TextureSet({
            id: defaultTextureSetId,
            colorTexture: defaultColorTexture,
            metallicRoughnessTexture: defaultMetalRoughTexture,
            normalsTexture: defaultNormalsTexture,
            emissiveTexture: defaultEmissiveTexture,
            occlusionTexture: defaultOcclusionTexture
        });
    }

    #getInstancingLayer(origin: math.FloatArrayType, textureSetId: string, geometryId: string) {
        const layerId = `${origin[0]}.${origin[1]}.${origin[2]}.${textureSetId}.${geometryId}`;
        let instancingLayer = this.#instancingLayers[layerId];
        if (instancingLayer) {
            return instancingLayer;
        }
        let textureSet;
        if (textureSetId !== undefined) {
            textureSet = this.#textureSets[textureSetId];
            if (!textureSet) {
                this.error(`TextureSet not found: ${textureSetId} - ensure that you create it first with createTextureSet()`);
                return;
            }
        }
        const geometry = this.#geometries[geometryId];
        if (!this.#geometries[geometryId]) {
            this.error(`Geometry not found: ${geometryId} - ensure that you create it first with createGeometry()`);
            return;
        }
        switch (geometry.primitive) {
            case TrianglesPrimitive:
                instancingLayer = new TrianglesInstancingLayer({
                    sceneModel: this,
                    textureSet,
                    geometry,
                    origin,
                    layerIndex: 0,
                    solid: false
                });
                break;
            case SolidPrimitive:
                instancingLayer = new TrianglesInstancingLayer({
                    sceneModel: this,
                    textureSet,
                    geometry,
                    origin,
                    layerIndex: 0,
                    solid: true
                });
                break;
            case SurfacePrimitive:
                instancingLayer = new TrianglesInstancingLayer({
                    sceneModel: this,
                    textureSet,
                    geometry,
                    origin,
                    layerIndex: 0,
                    solid: false
                });
                break;
            case LinesPrimitive:
                instancingLayer = new LinesInstancingLayer({
                    sceneModel: this,
                    textureSet,
                    geometry,
                    origin,
                    layerIndex: 0
                });
                break;
            case PointsPrimitive:
                instancingLayer = new PointsInstancingLayer({
                    sceneModel: this,
                    textureSet,
                    geometry,
                    origin,
                    layerIndex: 0
                });
                break;
        }
        this.#instancingLayers[layerId] = instancingLayer;
        this.#layerList.push(instancingLayer);
        return instancingLayer;
    }

    #rebuildAABB() {
        collapseAABB3(this.#aabb);
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            const sceneObject = this.sceneObjectList[i];
            expandAABB3(this.#aabb, sceneObject.aabb);
        }
        this.#aabbDirty = false;
    }

    #getActiveSectionPlanesForLayer(layer: any) {
        const drawFlags = this.drawFlags;
        const sectionPlanes = this.view.sectionPlanesList;
        const numSectionPlanes = sectionPlanes.length;
        const baseIndex = layer.layerIndex * numSectionPlanes;
        if (numSectionPlanes > 0) {
            for (let i = 0; i < numSectionPlanes; i++) {
                const sectionPlane = sectionPlanes[i];
                if (!sectionPlane.active) {
                    drawFlags.sectionPlanesActivePerLayer[baseIndex + i] = false;

                } else {
                    drawFlags.sectionPlanesActivePerLayer[baseIndex + i] = true;
                    drawFlags.sectioned = true;
                }
            }
        }
        return true;
    }

    #updateDrawFlagsVisibleLayers() {
        const drawFlags = this.drawFlags;
        drawFlags.numLayers = this.#layerList.length;
        drawFlags.numVisibleLayers = 0;
        for (let layerIndex = 0, len = this.#layerList.length; layerIndex < len; layerIndex++) {
            const layer = this.#layerList[layerIndex];
            const layerVisible = this.#getActiveSectionPlanesForLayer(layer);
            if (layerVisible) {
                drawFlags.visibleLayers[drawFlags.numVisibleLayers++] = layerIndex;
            }
        }
    }

    #updateDrawFlags() {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        if (this.numCulledLayerPortions === this.numPortions) {
            return;
        }
        const drawFlags = this.drawFlags;
        drawFlags.colorOpaque = (this.numTransparentLayerPortions < this.numPortions);
        if (this.numTransparentLayerPortions > 0) {
            drawFlags.colorTransparent = true;
        }
        if (this.numXRayedLayerPortions > 0) {
            const xrayMaterial = this.view.xrayMaterial.state;
            if (xrayMaterial.fill) {
                if (xrayMaterial.fillAlpha < 1.0) {
                    drawFlags.xrayedSilhouetteTransparent = true;
                } else {
                    drawFlags.xrayedSilhouetteOpaque = true;
                }
            }
            if (xrayMaterial.edges) {
                if (xrayMaterial.edgeAlpha < 1.0) {
                    drawFlags.xrayedEdgesTransparent = true;
                } else {
                    drawFlags.xrayedEdgesOpaque = true;
                }
            }
        }
        if (this.numEdgesLayerPortions > 0) {
            const edgeMaterial = this.view.edgeMaterial.state;
            if (edgeMaterial.edges) {
                drawFlags.edgesOpaque = (this.numTransparentLayerPortions < this.numPortions);
                if (this.numTransparentLayerPortions > 0) {
                    drawFlags.edgesTransparent = true;
                }
            }
        }
        if (this.numSelectedLayerPortions > 0) {
            const selectedMaterial = this.view.selectedMaterial.state;
            if (selectedMaterial.fill) {
                if (selectedMaterial.fillAlpha < 1.0) {
                    drawFlags.selectedSilhouetteTransparent = true;
                } else {
                    drawFlags.selectedSilhouetteOpaque = true;
                }
            }
            if (selectedMaterial.edges) {
                if (selectedMaterial.edgeAlpha < 1.0) {
                    drawFlags.selectedEdgesTransparent = true;
                } else {
                    drawFlags.selectedEdgesOpaque = true;
                }
            }
        }
        if (this.numHighlightedLayerPortions > 0) {
            const highlightMaterial = this.view.highlightMaterial.state;
            if (highlightMaterial.fill) {
                if (highlightMaterial.fillAlpha < 1.0) {
                    drawFlags.highlightedSilhouetteTransparent = true;
                } else {
                    drawFlags.highlightedSilhouetteOpaque = true;
                }
            }
            if (highlightMaterial.edges) {
                if (highlightMaterial.edgeAlpha < 1.0) {
                    drawFlags.highlightedEdgesTransparent = true;
                } else {
                    drawFlags.highlightedEdgesOpaque = true;
                }
            }
        }
    }
}

