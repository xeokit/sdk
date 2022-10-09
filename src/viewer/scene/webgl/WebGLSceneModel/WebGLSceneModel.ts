import {Component} from "../../../Component";
import * as math from "../../../math";
import {WebGLMesh} from './lib/WebGLMesh';

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
} from "../../../constants";

import {FrameContext} from "../lib/FrameContext";
import {WebGLSceneRenderer} from "../WebGLSceneRenderer";
import {Scene} from "../../Scene";
import {View} from "../../../view/View";
import {FloatArrayType} from "../../../math/math";
import {worldToRTCPositions} from "../../../math/rtc";
import {WebGLGeometry} from "./lib/WebGLGeometry";
import {SceneModel} from "../../SceneModel";
import {RenderFlags} from "./lib/RenderFlags";
import {WebGLTextureSet} from "./lib/WebGLTextureSet";
import {getScratchMemory, putScratchMemory, ScratchMemory} from "./lib/ScratchMemory";
import {WebGLTexture} from "./lib/WebGLTexture";
import {Texture2D} from "../lib/Texture2D";
import {Events} from "../../../Events";
import {Transform} from "../../../viewer/../scene/Transform";
import {createUUID, loadArraybuffer} from "../../../utils";
import {WebGLSceneObject} from "./lib/WebGLSceneObject";
import {TrianglesBatchingLayer} from "./lib/layers/vboBatching/triangles/TrianglesBatchingLayer";
import {LinesBatchingLayer} from "./lib/layers/vboBatching/lines/LinesBatchingLayer";
import {WebGLSceneRendererDrawableModel} from "../WebGLSceneRendererDrawableModel";
import {collapseAABB3, expandAABB3} from "../../../math/boundaries";
import {buildEdgeIndices} from "../../../math/geometry";
import {GeometryParams, MeshParams, SceneObjectParams, TextureParams, TextureSetParams} from "../../../index";
import {getKTX2TextureTranscoder} from "../textureTranscoders/KTX2TextureTranscoder/KTX2TextureTranscoder";
import {LinesInstancingLayer} from "./lib/layers/vboInstancing/lines/LinesInstancingLayer";
import {PointsBatchingLayer} from "./lib/layers/vboBatching/points/PointsBatchingLayer";
import {PointsInstancingLayer} from "./lib/layers/vboInstancing/points/PointsInstancingLayer";
import {TrianglesInstancingLayer} from "./lib/layers/vboInstancing/triangles/TrianglesInstancingLayer";

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

class WebGLSceneModel extends Component implements SceneModel, WebGLSceneRendererDrawableModel {

    readonly id: string;
    readonly view: View;
    readonly destroyed: boolean;

    webglSceneRenderer: WebGLSceneRenderer;
    sceneObjects: { [key: string]: WebGLSceneObject };
    sceneObjectList: WebGLSceneObject[];
    numPortions: number;
    renderFlags: RenderFlags;
    numVisibleLayerPortions: number;
    numEdgesLayerPortions: number;
    numCulledLayerPortions: number;
    numTransparentLayerPortions: number;
    numHighlightedLayerPortions: number;
    numClippableLayerPortions: number;
    numXRayedLayerPortions: number;
    numSelectedLayerPortions: number;
    numPickableLayerPortions: number;
    _opacity: number;
    _colorize: FloatArrayType;
    _visible: boolean;
    _xrayed: boolean;
    _selected: boolean;
    _edges: boolean;
    _culled: boolean;
    _clippable: boolean;
    _collidable: boolean;
    _pickable: boolean;
    _highlighted: boolean;
    _castsShadow: boolean;
    _receivesShadow: boolean;
    readonly scene: Scene;
    readonly events: Events;
    #layerList: any[];
    #textures: { [key: string]: WebGLTexture };
    #textureSets: { [key: string]: WebGLTextureSet };
    #geometries: { [key: string]: WebGLGeometry };
    #meshes: { [key: string]: WebGLMesh };
    private numGeometries: number;
    private numEntities: number;
    private _textureTranscoder: any;
    private _maxGeometryBatchSize: number;
    #aabbDirty: boolean;
    #lastOrigin: FloatArrayType;
    #lastPositionsDecompressMatrix: FloatArrayType;
    #edgeThreshold: number;
    #instancingLayers: { [key: string]: any };
    #lastPortionHadNormals: boolean;
    #currentBatchingLayers: { [key: string]: any };
    #scratchMemory: ScratchMemory;
    #numTriangles: number;
    #numLines: number;
    #numPoints: number;
    #aabb: FloatArrayType;
    private _viewMatrixDirty: boolean;
    private _worldMatrixNonIdentity: boolean;
    private _onCameraViewMatrix: number;
    private _isModel: any;
    private _lastuvsDecompressMatrix: FloatArrayType;
    private _lastTextureSetId: String;

    constructor(cfg: {
        pbrEnabled?: boolean;
        saoEnabled?: boolean;
        id: string,
        isModel?: boolean;
        matrix?: FloatArrayType;
        scale?: FloatArrayType;
        view: View,
        scene: Scene,
        webglSceneRenderer: WebGLSceneRenderer
        quaternion?: FloatArrayType;
        rotation?: FloatArrayType;
        position?: FloatArrayType;
        origin?: FloatArrayType;
        edgeThreshold?: number;
        textureTranscoder?: any;
        maxGeometryBatchSize?: number;
    }) {
        super(cfg.view);

        this.id = cfg.id;
        this.events = new Events();
        this.scene = cfg.scene;
        this.view = cfg.view;
        this.webglSceneRenderer = cfg.webglSceneRenderer;

        this._textureTranscoder = cfg.textureTranscoder || getKTX2TextureTranscoder(this.scene.viewer);

        this._maxGeometryBatchSize = cfg.maxGeometryBatchSize;

        this.#aabb = collapseAABB3();
        this.#aabbDirty = false;
        this.#layerList = []; // For GL state efficiency when drawing, InstancingLayers are in first part, BatchingLayers are in second
        this.sceneObjectList = [];

        this.#lastOrigin = null;
        this.#lastPositionsDecompressMatrix = null;
        this.#lastPortionHadNormals = null;

        this.#instancingLayers = {};
        this.#currentBatchingLayers = {};

        this.#scratchMemory = getScratchMemory();

        this.#geometries = {};
        this.#textures = {};
        this.#textureSets = {};
        this.#meshes = {};

        /** @private **/
        this.renderFlags = new RenderFlags();

        /**
         * @private
         */
        this.numGeometries = 0; // Number of geometries created with createGeometry()

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

        /** @private */
        this.numEntities = 0;

        /** @private */
        this.#numTriangles = 0;

        /** @private */
        this.#numLines = 0;

        /** @private */
        this.#numPoints = 0;

        this.#edgeThreshold = cfg.edgeThreshold || 10;

        // Build static matrix

        this._origin = math.vec3(cfg.origin || [0, 0, 0]);
        this._position = math.vec3(cfg.position || [0, 0, 0]);
        this._rotation = math.vec3(cfg.rotation || [0, 0, 0]);
        this._quaternion = math.vec4(cfg.quaternion || [0, 0, 0, 1]);
        if (cfg.rotation) {
            math.eulerToQuaternion(this._rotation, "XYZ", this._quaternion);
        }
        this._scale = math.vec3(cfg.scale || [1, 1, 1]);
        this._worldMatrix = math.mat4();
        math.composeMat4(this._position, this._quaternion, this._scale, this._worldMatrix);
        this._worldNormalMatrix = math.mat4();
        math.inverseMat4(this._worldMatrix, this._worldNormalMatrix);
        math.transposeMat4(this._worldNormalMatrix);

        if (cfg.matrix || cfg.position || cfg.rotation || cfg.scale || cfg.quaternion) {
            this._viewMatrix = math.mat4();
            this._viewNormalMatrix = math.mat4();
            this._viewMatrixDirty = true;
            this._worldMatrixNonIdentity = true;
        }

        this._opacity = 1.0;
        this._colorize = [1, 1, 1];

        this._saoEnabled = (cfg.saoEnabled !== false);
        this._pbrEnabled = (cfg.pbrEnabled !== false);
        this._colorTextureEnabled = true;

        this._isModel = cfg.isModel;

        this._onCameraViewMatrix = this.view.camera.events.on("matrix", () => {
            this._viewMatrixDirty = true;
        });

        this._createDefaultTextureSet();
    }

    _origin: FloatArrayType;

    get origin(): FloatArrayType {
        return this._origin;
    }

    _position: FloatArrayType;

    get position(): FloatArrayType {
        return this._position;
    }

    _rotation: FloatArrayType;

    get rotation(): FloatArrayType {
        return this._rotation;
    }

    _quaternion: FloatArrayType;

    get quaternion(): FloatArrayType {
        return this._quaternion;
    }

    _scale: FloatArrayType;

    get scale(): FloatArrayType {
        return this._scale;
    }

    _worldMatrix: FloatArrayType;

    get worldMatrix(): FloatArrayType {
        return this._worldMatrix;
    }

    _worldNormalMatrix: FloatArrayType;

    get worldNormalMatrix(): FloatArrayType {
        return this._worldNormalMatrix;
    }

    _viewMatrix: FloatArrayType;

    get viewMatrix(): FloatArrayType {
        if (!this._viewMatrix) {
            return this.view.camera.viewMatrix;
        }
        if (this._viewMatrixDirty) {
            math.mulMat4(this.view.camera.viewMatrix, this._worldMatrix, this._viewMatrix);
            math.inverseMat4(this._viewMatrix, this._viewNormalMatrix);
            math.transposeMat4(this._viewNormalMatrix);
            this._viewMatrixDirty = false;
        }
        return this._viewMatrix;
    }

    _viewNormalMatrix: FloatArrayType;

    get viewNormalMatrix(): FloatArrayType {
        if (!this._viewNormalMatrix) {
            return this.view.camera.viewNormalMatrix;
        }
        if (this._viewMatrixDirty) {
            math.mulMat4(this.view.camera.viewMatrix, this._worldMatrix, this._viewMatrix);
            math.inverseMat4(this._viewMatrix, this._viewNormalMatrix);
            math.transposeMat4(this._viewNormalMatrix);
            this._viewMatrixDirty = false;
        }
        return this._viewNormalMatrix;
    }

    _saoEnabled: boolean;

    get saoEnabled() {
        return this._saoEnabled;
    }

    _pbrEnabled: boolean;

    get pbrEnabled() {
        return this._pbrEnabled;
    }

    _colorTextureEnabled: boolean;

    get colorTextureEnabled() {
        return this._colorTextureEnabled;
    }

    _backfaces: boolean;

    get backfaces(): boolean {
        return this._backfaces;
    }

    set backfaces(backfaces: boolean) {
        backfaces = !!backfaces;
        this._backfaces = backfaces;
        this.webglSceneRenderer.setImageDirty();
    }

    get matrix(): FloatArrayType {
        return this._worldMatrix;
    }

    get aabb(): FloatArrayType {
        if (this.#aabbDirty) {
            this._rebuildAABB();
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

    _createDefaultTextureSet() {
        // Every VBOSceneModelMesh gets at least the default TextureSet,
        // which contains empty default textures filled with color
        const defaultColorTexture = new WebGLTexture({
            id: defaultColorTextureId,
            texture: new Texture2D({
                gl: this.webglSceneRenderer.gl,
                preloadColor: [1, 1, 1, 1] // [r, g, b, a]})
            })
        });
        const defaultMetalRoughTexture = new WebGLTexture({
            id: defaultMetalRoughTextureId,
            texture: new Texture2D({
                gl: this.webglSceneRenderer.gl,
                preloadColor: [0, 1, 1, 1] // [unused, roughness, metalness, unused]
            })
        });
        const defaultNormalsTexture = new WebGLTexture({
            id: defaultNormalsTextureId,
            texture: new Texture2D({
                gl: this.webglSceneRenderer.gl,
                preloadColor: [0, 0, 0, 0] // [x, y, z, unused] - these must be zeros
            })
        });
        const defaultEmissiveTexture = new WebGLTexture({
            id: defaultEmissiveTextureId,
            texture: new Texture2D({
                gl: this.webglSceneRenderer.gl,
                preloadColor: [0, 0, 0, 1] // [x, y, z, unused]
            })
        });
        const defaultOcclusionTexture = new WebGLTexture({
            id: defaultOcclusionTextureId,
            texture: new Texture2D({
                gl: this.webglSceneRenderer.gl,
                preloadColor: [1, 1, 1, 1] // [x, y, z, unused]
            })
        });
        this.#textures[defaultColorTextureId] = defaultColorTexture;
        this.#textures[defaultMetalRoughTextureId] = defaultMetalRoughTexture;
        this.#textures[defaultNormalsTextureId] = defaultNormalsTexture;
        this.#textures[defaultEmissiveTextureId] = defaultEmissiveTexture;
        this.#textures[defaultOcclusionTextureId] = defaultOcclusionTexture;
        this.#textureSets[defaultTextureSetId] = new WebGLTextureSet({
            id: defaultTextureSetId,
            colorTexture: defaultColorTexture,
            metallicRoughnessTexture: defaultMetalRoughTexture,
            normalsTexture: defaultNormalsTexture,
            emissiveTexture: defaultEmissiveTexture,
            occlusionTexture: defaultOcclusionTexture
        });
    }

    /**
     * @private
     */
    setVisible(viewIndex: number, visible: boolean) {
        visible = visible !== false;
        this._visible = visible;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setVisible(viewIndex, visible);
        }
        this.webglSceneRenderer.setImageDirty(viewIndex);
    }

    /**
     * @private
     */
    setXrayed(viewIndex: number, xrayed: boolean) {
        xrayed = !!xrayed;
        this._xrayed = xrayed;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setXRayed(viewIndex, xrayed);
        }
        this.webglSceneRenderer.setImageDirty(viewIndex);
    }

    setHighlighted(viewIndex: number, highlighted: boolean) {
        highlighted = !!highlighted;
        this._highlighted = highlighted;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setHighlighted(viewIndex, highlighted);
        }
        this.webglSceneRenderer.setImageDirty(viewIndex);
    }

    setSelected(viewIndex: number, selected: boolean) {
        selected = !!selected;
        this._selected = selected;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setSelected(viewIndex, selected);
        }
        this.webglSceneRenderer.setImageDirty(viewIndex);
    }

    setEdges(viewIndex: number, edges: boolean) {
        edges = !!edges;
        this._edges = edges;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setEdges(viewIndex, edges);
        }
        this.webglSceneRenderer.setImageDirty(viewIndex);
    }

    setCulled(viewIndex: number, culled: boolean) {
        culled = !!culled;
        this._culled = culled;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setCulled(viewIndex, culled);
        }
        this.webglSceneRenderer.setImageDirty(viewIndex);
    }

    setClippable(viewIndex: number, clippable: boolean) {
        clippable = clippable !== false;
        this._clippable = clippable;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setClippable(viewIndex, clippable);
        }
        this.webglSceneRenderer.setImageDirty(viewIndex);
    }

    setCollidable(viewIndex: number, collidable: boolean) {
        collidable = collidable !== false;
        this._collidable = collidable;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setCollidable(viewIndex, collidable);
        }
    }

    setPickable(viewIndex: number, pickable: boolean) {
        pickable = pickable !== false;
        this._pickable = pickable;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setPickable(viewIndex, pickable);
        }
    }

    setColorize(viewIndex: number, colorize: FloatArrayType) {
        this._colorize = colorize;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setColorize(viewIndex, colorize);
        }
    }

    setOpacity(viewIndex: number, opacity: number) {
        this._opacity = opacity;
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i].setOpacity(viewIndex, opacity);
        }
    }

    setCastsShadow(viewIndex: number, castsShadow: boolean) {
        // castsShadow = (castsShadow !== false);
        // if (castsShadow !== this._castsShadow) {
        //     this._castsShadow = castsShadow;
        //     this.webglSceneRenderer.setImageDirty(viewIndex);
        // }
    }

    setReceivesShadow(viewIndex: number, receivesShadow: number) {
        // receivesShadow = (receivesShadow !== false);
        // if (receivesShadow !== this._receivesShadow) {
        //     this._receivesShadow = receivesShadow;
        //     this.webglSceneRenderer.setImageDirty(viewIndex);
        // }
    }

    getPickViewMatrix(pickViewMatrix: FloatArrayType) {
        if (!this._viewMatrix) {
            return pickViewMatrix;
        }
        return this._viewMatrix;
    }

    createTransform(cfg: {
        id: string,
        parentTransformId?: string,
        matrix: FloatArrayType,
    }): Transform {
        return null;
    }

    createGeometry(cfg: GeometryParams): void {
        const geometryId = cfg.id;
        if (geometryId === undefined || geometryId === null) {
            this.scene.error("Config missing: id");
            return;
        }
        if (this.#geometries[geometryId]) {
            this.scene.error("Geometry already created: " + geometryId);
            return;
        }
        const primitive = cfg.primitive;
        if (primitive === undefined || primitive === null) {
            this.scene.error("Param expected: primitive");
            return;
        }
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            this.scene.error(`Unsupported value for 'primitive': '${primitive}' - supported values are 'points', 'lines', 'triangles', 'solid' and 'surface'. Defaulting to 'triangles'.`);
            return;
        }
        if (!cfg.positions && !cfg.positionsCompressed) {
            this.scene.error("Param expected: `positions` or `positionsCompressed'");
            return null;
        }
        if (cfg.positionsCompressed && !cfg.positionsDecompressMatrix) {
            this.scene.error("Param expected: `positionsDecompressMatrix` (required for `positionsCompressed')");
            return null;
        }
        if (cfg.uvsCompressed && !cfg.uvsDecompressMatrix) {
            this.scene.error("Param expected: `uvsDecompressMatrix` (required for `uvsCompressed')");
            return null;
        }
        if (!cfg.indices && primitive !== PointsPrimitive) {
            this.scene.error(`Param expected: indices (required for '${primitive}' primitive type)`);
            return null;
        }
        const geometry = new WebGLGeometry(this, this.webglSceneRenderer.gl, cfg);
        this.#geometries[geometryId] = geometry;
        this.#numTriangles += (cfg.indices ? Math.round(cfg.indices.length / 3) : 0);
        this.numGeometries++;
    }

    createTexture(cfg: TextureParams): void {
        const textureId = cfg.id;
        if (textureId === undefined || textureId === null) {
            this.scene.error("Config missing: id");
            return;
        }
        if (this.#textures[textureId]) {
            this.scene.error("Texture already created: " + textureId);
            return;
        }
        if (!cfg.src && !cfg.image && !cfg.buffers) {
            this.scene.error("Param expected: `src`, `image' or 'buffers'");
            return null;
        }
        let minFilter = cfg.minFilter || LinearMipmapLinearFilter;
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
        let magFilter = cfg.magFilter || LinearFilter;
        if (magFilter !== LinearFilter && magFilter !== NearestFilter) {
            this.scene.error(`[createTexture] Unsupported value for 'magFilter' - supported values are LinearFilter and NearestFilter. Defaulting to LinearFilter.`);
            magFilter = LinearFilter;
        }
        let wrapS = cfg.wrapS || RepeatWrapping;
        if (wrapS !== ClampToEdgeWrapping && wrapS !== MirroredRepeatWrapping && wrapS !== RepeatWrapping) {
            this.scene.error(`[createTexture] Unsupported value for 'wrapS' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapS = RepeatWrapping;
        }
        let wrapT = cfg.wrapT || RepeatWrapping;
        if (wrapT !== ClampToEdgeWrapping && wrapT !== MirroredRepeatWrapping && wrapT !== RepeatWrapping) {
            this.scene.error(`[createTexture] Unsupported value for 'wrapT' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapT = RepeatWrapping;
        }
        let wrapR = cfg.wrapR || RepeatWrapping;
        if (wrapR !== ClampToEdgeWrapping && wrapR !== MirroredRepeatWrapping && wrapR !== RepeatWrapping) {
            this.scene.error(`[createTexture] Unsupported value for 'wrapR' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapR = RepeatWrapping;
        }
        let encoding = cfg.encoding || LinearEncoding;
        if (encoding !== LinearEncoding && encoding !== sRGBEncoding) {
            this.scene.error("[createTexture] Unsupported value for 'encoding' - supported values are LinearEncoding and sRGBEncoding. Defaulting to LinearEncoding.");
            encoding = LinearEncoding;
        }
        const texture = new Texture2D({gl: this.webglSceneRenderer.gl});
        if (cfg.preloadColor) {
            texture.setPreloadColor(cfg.preloadColor);
        }
        if (cfg.image) { // Ignore transcoder for Images
            const image = cfg.image;
            image.crossOrigin = "Anonymous";
            texture.setImage(image, {minFilter, magFilter, wrapS, wrapT, wrapR, flipY: cfg.flipY, encoding});

        } else if (cfg.src) {
            const ext = cfg.src.split('.').pop();
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
                            flipY: cfg.flipY,
                            encoding
                        });
                    };
                    image.src = cfg.src; // URL or Base64 string
                    break;
                default: // Assume other file types need transcoding
                    if (!this._textureTranscoder) {
                        this.scene.error(`Can't create texture from 'src' - VBOSceneModel needs to be configured with a TextureTranscoder for this file type ('${ext}')`);
                    } else {
                        loadArraybuffer(cfg.src, (arrayBuffer: ArrayBuffer) => {
                                if (!arrayBuffer.byteLength) {
                                    this.scene.error(`Can't create texture from 'src': file data is zero length`);
                                    return;
                                }
                                this._textureTranscoder.transcode([arrayBuffer], texture).then(() => {
                                    this.webglSceneRenderer.setImageDirty();
                                });
                            },
                            (errMsg: string) => {
                                this.scene.error(`Can't create texture from 'src': ${errMsg}`);
                            });
                    }
                    break;
            }
        } else if (cfg.buffers) { // Buffers implicitly require transcoding
            if (!this._textureTranscoder) {
                this.scene.error(`Can't create texture from 'buffers' - VBOSceneModel needs to be configured with a TextureTranscoder for this option`);
            } else {
                this._textureTranscoder.transcode(cfg.buffers, texture).then(() => {
                    this.webglSceneRenderer.setImageDirty();
                });
            }
        }

        this.#textures[textureId] = new WebGLTexture({id: textureId, texture});
    }

    createTextureSet(cfg: TextureSetParams) {
        const textureSetId = cfg.id;
        if (textureSetId === undefined || textureSetId === null) {
            this.scene.error("Config missing: id");
            return;
        }
        if (this.#textureSets[textureSetId]) {
            this.scene.error(`Texture set already created: ${textureSetId}`);
            return;
        }
        let colorTexture;
        if (cfg.colorTextureId !== undefined && cfg.colorTextureId !== null) {
            colorTexture = this.#textures[cfg.colorTextureId];
            if (!colorTexture) {
                this.scene.error(`Texture not found: ${cfg.colorTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            colorTexture = this.#textures[defaultColorTextureId];
        }
        let metallicRoughnessTexture;
        if (cfg.metallicRoughnessTextureId !== undefined && cfg.metallicRoughnessTextureId !== null) {
            metallicRoughnessTexture = this.#textures[cfg.metallicRoughnessTextureId];
            if (!metallicRoughnessTexture) {
                this.scene.error(`Texture not found: ${cfg.metallicRoughnessTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            metallicRoughnessTexture = this.#textures[defaultMetalRoughTextureId];
        }
        let normalsTexture;
        if (cfg.normalsTextureId !== undefined && cfg.normalsTextureId !== null) {
            normalsTexture = this.#textures[cfg.normalsTextureId];
            if (!normalsTexture) {
                this.scene.error(`Texture not found: ${cfg.normalsTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            normalsTexture = this.#textures[defaultNormalsTextureId];
        }
        let emissiveTexture;
        if (cfg.emissiveTextureId !== undefined && cfg.emissiveTextureId !== null) {
            emissiveTexture = this.#textures[cfg.emissiveTextureId];
            if (!emissiveTexture) {
                this.scene.error(`Texture not found: ${cfg.emissiveTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            emissiveTexture = this.#textures[defaultEmissiveTextureId];
        }
        let occlusionTexture;
        if (cfg.occlusionTextureId !== undefined && cfg.occlusionTextureId !== null) {
            occlusionTexture = this.#textures[cfg.occlusionTextureId];
            if (!occlusionTexture) {
                this.scene.error(`Texture not found: ${cfg.occlusionTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            occlusionTexture = this.#textures[defaultOcclusionTextureId];
        }
        const textureSet = new WebGLTextureSet({
            id: textureSetId,
            colorTexture,
            metallicRoughnessTexture,
            normalsTexture,
            emissiveTexture,
            occlusionTexture
        });
        this.#textureSets[textureSetId] = textureSet;
    }

    createMesh(cfg: MeshParams): void {

        let id = cfg.id;
        if (id === undefined || id === null) {
            this.scene.error("Config missing: id");
            return;
        }

        if (this.#meshes[id]) {
            this.scene.error(`VBOSceneModel already has a mesh with this ID: ${id}`);
            return;
        }

        const geometryId = cfg.geometryId;
        const sharingGeometry = (cfg.geometryId !== undefined);
        if (sharingGeometry && !this.#geometries[cfg.geometryId]) {
            this.scene.error(`Geometry not found: ${cfg.geometryId} - ensure that you create it first with createGeometry()`);
            return;
        }

        const textureSetId = cfg.textureSetId || defaultTextureSetId;
        if (textureSetId) {
            if (!this.#textureSets[textureSetId]) {
                this.scene.error(`Texture set not found: ${textureSetId} - ensure that you create it first with createTextureSet()`);
                return;
            }
        }

        let portionId;

        const color = (cfg.color) ? new Uint8Array([Math.floor(cfg.color[0] * 255), Math.floor(cfg.color[1] * 255), Math.floor(cfg.color[2] * 255)]) : [255, 255, 255];
        const opacity = (cfg.opacity !== undefined && cfg.opacity !== null) ? Math.floor(cfg.opacity * 255) : 255;
        const metallic = (cfg.metallic !== undefined && cfg.metallic !== null) ? Math.floor(cfg.metallic * 255) : 0;
        const roughness = (cfg.roughness !== undefined && cfg.roughness !== null) ? Math.floor(cfg.roughness * 255) : 255;

        const mesh = new WebGLMesh({
            webglSceneRenderer: this.webglSceneRenderer,
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
            let worldMatrix = this._worldMatrixNonIdentity ? this._worldMatrix : null;

            if (cfg.matrix) {
                meshMatrix = cfg.matrix;
            } else {
                const scale = cfg.scale || defaultScale;
                const position = cfg.position || defaultPosition;
                const rotation = cfg.rotation || defaultRotation;
                math.eulerToQuaternion(rotation, "XYZ", defaultQuaternion);
                meshMatrix = math.composeMat4(position, defaultQuaternion, scale, tempMat4);
            }

            const origin = (cfg.origin) ? math.addVec3(this._origin, cfg.origin, tempVec3a) : this._origin;
            const instancingLayer = this._getInstancingLayer(origin, textureSetId, geometryId);

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

            const numTriangles = Math.round(instancingLayer.numIndices / 3);
            this.#numTriangles += numTriangles;
            mesh.numTriangles = numTriangles;

            mesh.origin = origin;

        } else { // Batching

            let primitive = cfg.primitive;
            if (primitive === undefined || primitive === null) {
                primitive = TrianglesPrimitive;
            }
            if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
                this.scene.error(`Unsupported value for 'primitive': '${primitive}'  ('geometryId' is absent) - supported values are 'points', 'lines', 'triangles', 'solid' and 'surface'.`);
                return;
            }
            if (!cfg.positions && !cfg.positionsCompressed) {
                this.scene.error("Param expected: 'positions' or 'positionsCompressed'  ('geometryId' is absent)");
                return null;
            }
            if (cfg.positions && cfg.positionsCompressed) {
                this.scene.error("Only one param expected, not both: 'positions' or 'positionsCompressed' ('geometryId' is absent)");
                return null;
            }
            if (cfg.positionsCompressed && !cfg.positionsDecompressMatrix) {
                this.scene.error("Param expected: 'positionsDecompressMatrix' (required for 'positionsCompressed'; 'geometryId' is absent)");
                return null;
            }
            if (cfg.uvsCompressed && !cfg.uvsDecompressMatrix) {
                this.scene.error("Param expected: `uvsDecompressMatrix` (required for `uvsCompressed'; 'geometryId' is absent)");
                return null;
            }
            if (!cfg.indices && primitive !== PointsPrimitive) {
                this.scene.error(`Param expected: indices (required for '${primitive}' primitive type)`);
                return null;
            }
            if (!cfg.indices && primitive !== PointsPrimitive) {
                this.scene.error("Config expected: indices (no meshIds provided, so expecting geometry arrays instead)");
                return null;
            }

            let indices = cfg.indices;
            let edgeIndices = cfg.edgeIndices;
            let origin = cfg.origin ? math.addVec3(this._origin, cfg.origin, tempVec3a) : this._origin;
            let positions = cfg.positions;

            if (positions) {
                const rtcCenter = math.vec3();
                const rtcPositions: number[] = [];
                const rtcNeeded = worldToRTCPositions(positions, rtcPositions, rtcCenter);
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
            if (cfg.positionsDecompressMatrix) {
                if (!this.#lastPositionsDecompressMatrix) {
                    needNewBatchingLayers = true;
                    this.#lastPositionsDecompressMatrix = math.mat4(cfg.positionsDecompressMatrix);

                } else {
                    if (!math.compareMat4(this.#lastPositionsDecompressMatrix, cfg.positionsDecompressMatrix)) {
                        needNewBatchingLayers = true;
                        // @ts-ignore
                        this.#lastPositionsDecompressMatrix.set(cfg.positionsDecompressMatrix)
                    }
                }
            }
            if (cfg.uvsDecompressMatrix) {
                if (!this._lastuvsDecompressMatrix) {
                    needNewBatchingLayers = true;
                    this._lastuvsDecompressMatrix = math.mat4(cfg.uvsDecompressMatrix);

                } else {
                    if (!math.compareMat4(this._lastuvsDecompressMatrix, cfg.uvsDecompressMatrix)) {
                        needNewBatchingLayers = true;
                        // @ts-ignore
                        this._lastuvsDecompressMatrix.set(cfg.uvsDecompressMatrix)
                    }
                }
            }
            if (cfg.textureSetId) {
                if (this._lastTextureSetId !== cfg.textureSetId) {
                    needNewBatchingLayers = true;
                    this._lastTextureSetId = cfg.textureSetId;
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

            const normalsProvided = (!!cfg.normals && cfg.normals.length > 0);
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

            const worldMatrix = this._worldMatrixNonIdentity ? this._worldMatrix : null;
            let meshMatrix;

            if (!cfg.positionsDecompressMatrix) {
                if (cfg.matrix) {
                    meshMatrix = cfg.matrix;
                } else {
                    const scale = cfg.scale || defaultScale;
                    const position = cfg.position || defaultPosition;
                    const rotation = cfg.rotation || defaultRotation;
                    math.eulerToQuaternion(rotation, "XYZ", defaultQuaternion);
                    meshMatrix = math.composeMat4(position, defaultQuaternion, scale, tempMat4);
                }
            }

            const textureSet = textureSetId ? this.#textureSets[textureSetId] : null;

            layer = this.#currentBatchingLayers[primitive];

            const lenPositions = (positions || cfg.positionsCompressed).length;

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
                            positionsDecompressMatrix: cfg.positionsDecompressMatrix,  // Can be undefined
                            uvsDecompressMatrix: cfg.uvsDecompressMatrix, // Can be undefined
                            origin,
                            maxGeometryBatchSize: this._maxGeometryBatchSize,
                            solid: (primitive === SolidPrimitive),
                            autoNormals: (!normalsProvided)
                        });
                        this.#layerList.push(layer);
                        this.#currentBatchingLayers[primitive] = layer;
                    }
                    if (!edgeIndices) {
                        edgeIndices = buildEdgeIndices(positions || cfg.positionsCompressed, indices, null, this.#edgeThreshold);
                    }
                    portionId = layer.createPortion({
                        positions: positions,
                        positionsCompressed: cfg.positionsCompressed,
                        normals: cfg.normals,
                        normalsCompressed: cfg.normalsCompressed,
                        colors: cfg.colors,
                        colorsCompressed: cfg.colorsCompressed,
                        uvs: cfg.uvs,
                        uvsCompressed: cfg.uvsCompressed,
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
                            positionsDecompressMatrix: cfg.positionsDecompressMatrix,  // Can be undefined
                            origin,
                            maxGeometryBatchSize: this._maxGeometryBatchSize
                        });
                        this.#layerList.push(layer);
                        this.#currentBatchingLayers[primitive] = layer;
                    }
                    portionId = layer.createPortion({
                        positions: positions,
                        positionsCompressed: cfg.positionsCompressed,
                        indices: indices,
                        colors: cfg.colors,
                        colorsCompressed: cfg.colorsCompressed,
                        color: color,
                        opacity: opacity,
                        meshMatrix: meshMatrix,
                        worldMatrix: worldMatrix,
                        worldAABB: mesh.aabb,
                        pickColor: pickColor
                    });
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
                            positionsDecompressMatrix: cfg.positionsDecompressMatrix,  // Can be undefined
                            origin,
                            maxGeometryBatchSize: this._maxGeometryBatchSize
                        });
                        this.#layerList.push(layer);
                        this.#currentBatchingLayers[primitive] = layer;
                    }
                    portionId = layer.createPortion({
                        positions: positions,
                        positionsCompressed: cfg.positionsCompressed,
                        colors: cfg.colors,
                        colorsCompressed: cfg.colorsCompressed,
                        color: color,
                        opacity: opacity,
                        meshMatrix: meshMatrix,
                        worldMatrix: worldMatrix,
                        worldAABB: mesh.aabb,
                        pickColor: pickColor
                    });
                    this.#numPoints += Math.round(lenPositions / 3);
                    break;
            }


            this.numGeometries++;
            mesh.origin = origin;
        }

        expandAABB3(this.#aabb, mesh.aabb);

        mesh.sceneObject = null; // Will be set within PerformanceModelNode constructor
        mesh.layer = layer;
        mesh.portionId = portionId;

        this.#meshes[id] = mesh;
    }

    _getInstancingLayer(origin: FloatArrayType, textureSetId: string, geometryId: string) {
        const layerId = `${origin[0]}.${origin[1]}.${origin[2]}.${textureSetId}.${geometryId}`;
        let instancingLayer = this.#instancingLayers[layerId];
        if (instancingLayer) {
            return instancingLayer;
        }
        let textureSet;
        if (textureSetId !== undefined) {
            textureSet = this.#textureSets[textureSetId];
            if (!textureSet) {
                this.scene.error(`TextureSet not found: ${textureSetId} - ensure that you create it first with createTextureSet()`);
                return;
            }
        }
        const geometry = this.#geometries[geometryId];
        if (!this.#geometries[geometryId]) {
            this.scene.error(`Geometry not found: ${geometryId} - ensure that you create it first with createGeometry()`);
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

    createSceneObject(cfg: SceneObjectParams) {
        let id = cfg.id;
        if (id === undefined) {
            id = createUUID();
        } else if (this.sceneObjects[id]) {
            this.error("SceneModel already has a SceneObject with this ID: " + id + " - will assign random ID");
            id = createUUID();
        }
        const meshIds = cfg.meshIds;
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
        this.numEntities++;
        return sceneObject;
    }

    /**
     * Finalizes this VBOSceneModel.
     *
     * Immediately creates the VBOSceneModel's {@link Entity}s within the {@link Scene}.
     *
     * Once finalized, you can't add anything more to this VBOSceneModel.
     */
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

        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            const sceneObject = this.sceneObjectList[i];
            sceneObject._finalize();
        }

        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            const sceneObject = this.sceneObjectList[i];
            sceneObject._finalize2();
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

        this.webglSceneRenderer.setImageDirty();

        this.scene.setAABBDirty();

        this.events.fire("finalized", {});
    }

    _rebuildAABB() {
        collapseAABB3(this.#aabb);
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            const sceneObject = this.sceneObjectList[i];
            expandAABB3(this.#aabb, sceneObject.aabb);
        }
        this.#aabbDirty = false;
    }

    rebuildRenderFlags() {
        this.renderFlags.reset();
        this.#updateRenderFlagsVisibleLayers();
        if (this.renderFlags.numLayers > 0 && this.renderFlags.numVisibleLayers === 0) {
            this.renderFlags.culled = true;
            return;
        }
        this.#updateRenderFlags();
    }

    _getActiveSectionPlanesForLayer(layer: any) {
        const renderFlags = this.renderFlags;
        const sectionPlanes = this.view.sectionPlanesList;
        const numSectionPlanes = sectionPlanes.length;
        const baseIndex = layer.layerIndex * numSectionPlanes;
        if (numSectionPlanes > 0) {
            for (let i = 0; i < numSectionPlanes; i++) {

                const sectionPlane = sectionPlanes[i];

                if (!sectionPlane.active) {
                    renderFlags.sectionPlanesActivePerLayer[baseIndex + i] = false;

                } else {
                    renderFlags.sectionPlanesActivePerLayer[baseIndex + i] = true;
                    renderFlags.sectioned = true;
                }
            }
        }
        return true;
    }

    drawColorOpaque(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawColorOpaque(renderFlags, frameContext);
        }
    }

    drawColorTransparent(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawColorTransparent(renderFlags, frameContext);
        }
    }

    drawDepth(frameContext: FrameContext) { // Dedicated to SAO because it skips transparent objects
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawDepth(renderFlags, frameContext);
        }
    }

    drawNormals(frameContext: FrameContext) { // Dedicated to SAO because it skips transparent objects
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawNormals(renderFlags, frameContext);
        }
    }

    drawSilhouetteXRayed(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawSilhouetteXRayed(renderFlags, frameContext);
        }
    }

    drawSilhouetteHighlighted(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawSilhouetteHighlighted(renderFlags, frameContext);
        }
    }

    drawSilhouetteSelected(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawSilhouetteSelected(renderFlags, frameContext);
        }
    }

    drawEdgesColorOpaque(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesColorOpaque(renderFlags, frameContext);
        }
    }

    drawEdgesColorTransparent(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesColorTransparent(renderFlags, frameContext);
        }
    }

    drawEdgesXRayed(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesXRayed(renderFlags, frameContext);
        }
    }

    drawEdgesHighlighted(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesHighlighted(renderFlags, frameContext);
        }
    }

    drawEdgesSelected(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawEdgesSelected(renderFlags, frameContext);
        }
    }

    drawOcclusion(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawOcclusion(renderFlags, frameContext);
        }
    }

    drawShadow(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawShadow(renderFlags, frameContext);
        }
    }

    drawPickMesh(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawPickMesh(renderFlags, frameContext);
        }
    }

    drawPickDepths(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawPickDepths(renderFlags, frameContext);
        }
    }

    drawPickNormals(frameContext: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this.#layerList[layerIndex].drawPickNormals(renderFlags, frameContext);
        }
    }

    destroy() {
        this.events.fire("destroyed", {}); // Fire this first
        for (let layerId in this.#currentBatchingLayers) {
            if (this.#currentBatchingLayers.hasOwnProperty(layerId)) {
                this.#currentBatchingLayers[layerId].destroy();
            }
        }
        this.#currentBatchingLayers = {};
        this.view.camera.events.off(this._onCameraViewMatrix);
        for (let i = 0, len = this.#layerList.length; i < len; i++) {
            this.#layerList[i].destroy();
        }
        for (let i = 0, len = this.sceneObjectList.length; i < len; i++) {
            this.sceneObjectList[i]._destroy();
        }
        Object.entries(this.#geometries).forEach(([key, geometry]) => {
            geometry.destroy();
        });
        this.#geometries = {};
        this.#textures = {};
        this.#textureSets = {};
        this.#meshes = {};
        this.sceneObjects = {};
        this.scene.setAABBDirty();
        putScratchMemory();
        super.destroy();
    }

    #updateRenderFlagsVisibleLayers() {
        const renderFlags = this.renderFlags;
        renderFlags.numLayers = this.#layerList.length;
        renderFlags.numVisibleLayers = 0;
        for (let layerIndex = 0, len = this.#layerList.length; layerIndex < len; layerIndex++) {
            const layer = this.#layerList[layerIndex];
            const layerVisible = this._getActiveSectionPlanesForLayer(layer);
            if (layerVisible) {
                renderFlags.visibleLayers[renderFlags.numVisibleLayers++] = layerIndex;
            }
        }
    }

    #updateRenderFlags() {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        if (this.numCulledLayerPortions === this.numPortions) {
            return;
        }
        const renderFlags = this.renderFlags;
        renderFlags.colorOpaque = (this.numTransparentLayerPortions < this.numPortions);
        if (this.numTransparentLayerPortions > 0) {
            renderFlags.colorTransparent = true;
        }
        if (this.numXRayedLayerPortions > 0) {
            const xrayMaterial = this.view.xrayMaterial.state;
            if (xrayMaterial.fill) {
                if (xrayMaterial.fillAlpha < 1.0) {
                    renderFlags.xrayedSilhouetteTransparent = true;
                } else {
                    renderFlags.xrayedSilhouetteOpaque = true;
                }
            }
            if (xrayMaterial.edges) {
                if (xrayMaterial.edgeAlpha < 1.0) {
                    renderFlags.xrayedEdgesTransparent = true;
                } else {
                    renderFlags.xrayedEdgesOpaque = true;
                }
            }
        }
        if (this.numEdgesLayerPortions > 0) {
            const edgeMaterial = this.view.edgeMaterial.state;
            if (edgeMaterial.edges) {
                renderFlags.edgesOpaque = (this.numTransparentLayerPortions < this.numPortions);
                if (this.numTransparentLayerPortions > 0) {
                    renderFlags.edgesTransparent = true;
                }
            }
        }
        if (this.numSelectedLayerPortions > 0) {
            const selectedMaterial = this.view.selectedMaterial.state;
            if (selectedMaterial.fill) {
                if (selectedMaterial.fillAlpha < 1.0) {
                    renderFlags.selectedSilhouetteTransparent = true;
                } else {
                    renderFlags.selectedSilhouetteOpaque = true;
                }
            }
            if (selectedMaterial.edges) {
                if (selectedMaterial.edgeAlpha < 1.0) {
                    renderFlags.selectedEdgesTransparent = true;
                } else {
                    renderFlags.selectedEdgesOpaque = true;
                }
            }
        }
        if (this.numHighlightedLayerPortions > 0) {
            const highlightMaterial = this.view.highlightMaterial.state;
            if (highlightMaterial.fill) {
                if (highlightMaterial.fillAlpha < 1.0) {
                    renderFlags.highlightedSilhouetteTransparent = true;
                } else {
                    renderFlags.highlightedSilhouetteOpaque = true;
                }
            }
            if (highlightMaterial.edges) {
                if (highlightMaterial.edgeAlpha < 1.0) {
                    renderFlags.highlightedEdgesTransparent = true;
                } else {
                    renderFlags.highlightedEdgesOpaque = true;
                }
            }
        }
    }
}

export {WebGLSceneModel};