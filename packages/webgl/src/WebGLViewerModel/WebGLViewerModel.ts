import {EventDispatcher} from "strongly-typed-events";
import {
    Component,
    EventEmitter,
    GeometryCompressedParams,
    GeometryParams,
    MeshParams,
    ObjectParams,
    TextureParams,
    TextureSetParams,
    TransformParams
} from "@xeokit/core/components";
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
} from "@xeokit/core/constants";
import {compressGeometryParams} from "@xeokit/math/compression";
import {createUUID, loadArraybuffer} from "@xeokit/core/utils";
import {collapseAABB3, expandAABB3} from "@xeokit/math/boundaries";
import {
    composeMat4,
    createMat4,
    createVec3,
    createVec4,
    eulerToQuaternion,
    identityQuaternion,
    mulMat4
} from "@xeokit/math/matrix";
import {FloatArrayParam} from "@xeokit/math/math";

import type {Camera, TextureTranscoder, View} from "@xeokit/viewer";
import {Viewer} from "@xeokit/viewer";

import {Texture2D} from "../lib/Texture2D";
import type {WebGLRenderer} from "../WebGLRenderer";
import {Layer, LayerParams} from "./Layer";
import {MeshImpl} from './MeshImpl';
import {TextureSetImpl} from "./TextureSetImpl";
import {TextureImpl} from "./TextureImpl";
import {ViewerObjectImpl} from "./ViewerObjectImpl";
import type {RenderContext} from "../RenderContext";
import {ViewerModel} from "@xeokit/viewer/src/ViewerModel";
import {GeometryImpl} from "./GeometryImpl";

const tempVec3a = createVec3();
const tempMat4 = createMat4();

const defaultScale = createVec3([1, 1, 1]);
const defaultPosition = createVec3([0, 0, 0]);
const defaultRotation = createVec3([0, 0, 0]);
const defaultQuaternion = identityQuaternion();

const defaultColorTextureId = "defaultColorTexture";
const defaultMetalRoughTextureId = "defaultMetalRoughTexture";
const defaultNormalsTextureId = "defaultNormalsTexture";
const defaultEmissiveTextureId = "defaultEmissiveTexture";
const defaultOcclusionTextureId = "defaultOcclusionTexture";
const defaultTextureSetId = "defaultTextureSet";


/**
 * @private
 */
export class WebGLViewerModel extends Component implements ViewerModel {

    readonly qualityRender: boolean;
    declare readonly id: string;
    declare readonly destroyed: boolean;
    declare built: boolean;

    readable: boolean;
    geometries: { [key: string]: GeometryImpl };
    textures: { [key: string]: TextureImpl };
    textureSets: { [key: string]: TextureSetImpl; };
    meshes: { [key: string]: MeshImpl; };
    objects: { [key: string]: ViewerObjectImpl };
    objectList: ViewerObjectImpl[];

    readonly viewer: Viewer;

    layerList: Layer[];
    readonly onBuilt: EventEmitter<ViewerModel, null>;
    readonly onDestroyed: EventEmitter<Component, null>;
    #view: View;
    #webglRenderer: WebGLRenderer;
    #renderContext: RenderContext;
    #origin: FloatArrayParam;
    #position: FloatArrayParam;
    #rotation: FloatArrayParam;
    #quaternion: FloatArrayParam;
    #scale: FloatArrayParam;
    #worldMatrix: FloatArrayParam;
    #viewMatrix: FloatArrayParam;
    #colorTextureEnabled: boolean;
    #backfaces: boolean;
    #meshes: { [key: string]: MeshImpl };
    #layers: { [key: string]: Layer };
    #numGeometries: number;
    #numTriangles: number;
    #numLines: number;
    #numPoints: number;
    #numViewerObjects: number;
    #textureTranscoder: TextureTranscoder;
    #aabbDirty: boolean;
    #edgeThreshold: number;
    #currentLayers: { [key: string]: any };
    #aabb: FloatArrayParam;
    #viewMatrixDirty: boolean;
    #worldMatrixNonIdentity: boolean;
    #onCameraViewMatrix: () => void;
    #viewLayerId: string | undefined;

    constructor(params: {
        id: string;
        matrix?: FloatArrayParam;
        scale?: FloatArrayParam;
        view: View;
        webglRenderer: WebGLRenderer;
        renderContext: RenderContext;
        quaternion?: FloatArrayParam;
        rotation?: FloatArrayParam;
        position?: FloatArrayParam;
        origin?: FloatArrayParam;
        edgeThreshold?: number;
        textureTranscoder: TextureTranscoder;
        qualityRender?: boolean;
        viewLayerId?: string;
    }) {

        super(params.view);

        this.id = params.id;
        this.objects = {};
        this.objectList = [];

        this.viewer = params.view.viewer;
        this.#view = params.view;
        this.#webglRenderer = params.webglRenderer;
        this.#renderContext = params.renderContext;
        this.#textureTranscoder = params.textureTranscoder;

        this.#aabb = this.collapseAABB3();
        this.#aabbDirty = false;
        this.#layers = {};
        this.layerList = [];
        this.#currentLayers = {};
        this.geometries = {};
        this.textures = {};
        this.textureSets = {};
        this.#meshes = {};
        this.#numGeometries = 0;
        this.#numViewerObjects = 0;

        this.#numTriangles = 0;
        this.#numLines = 0;
        this.#numPoints = 0;
        this.#edgeThreshold = params.edgeThreshold || 10;

        this.built = false;

        // Build static matrix

        this.#origin = createVec3(params.origin || [0, 0, 0]);
        this.#position = createVec3(params.position || [0, 0, 0]);
        this.#rotation = createVec3(params.rotation || [0, 0, 0]);
        this.#quaternion = createVec4(params.quaternion || [0, 0, 0, 1]);
        if (params.rotation) {
            eulerToQuaternion(this.#rotation, "XYZ", this.#quaternion);
        }
        this.#scale = createVec3(params.scale || [1, 1, 1]);
        this.#worldMatrix = createMat4();
        composeMat4(this.#position, this.#quaternion, this.#scale, this.#worldMatrix);

        if (params.matrix || params.position || params.rotation || params.scale || params.quaternion) {
            this.#viewMatrix = createMat4();
            this.#viewMatrixDirty = true;
            this.#worldMatrixNonIdentity = true;
        }

        this.qualityRender = (params.qualityRender !== false);

        this.#viewLayerId = params.viewLayerId;

        this.#onCameraViewMatrix = this.#view.camera.onViewMatrix.subscribe((camera: Camera, viewMatrix: FloatArrayParam) => {
            this.#viewMatrixDirty = true;
        });

        this.#createDefaultTextureSet();

        this.onBuilt = new EventEmitter(new EventDispatcher<ViewerModel, null>());
    }

    get origin(): FloatArrayParam {
        return this.#origin;
    }

    get position(): FloatArrayParam {
        return this.#position;
    }

    get rotation(): FloatArrayParam {
        return this.#rotation;
    }

    get quaternion(): FloatArrayParam {
        return this.#quaternion;
    }

    get scale(): FloatArrayParam {
        return this.#scale;
    }

    get worldMatrix(): FloatArrayParam {
        return this.#worldMatrix;
    }

    get viewMatrix(): FloatArrayParam {
        if (!this.#viewMatrix) {
            return this.#view.camera.viewMatrix;
        }
        if (this.#viewMatrixDirty) {
            mulMat4(this.#view.camera.viewMatrix, this.#worldMatrix, this.#viewMatrix);
            this.#viewMatrixDirty = false;
        }
        return this.#viewMatrix;
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
        this.#webglRenderer.setImageDirty();
    }

    get matrix(): FloatArrayParam {
        return this.#worldMatrix;
    }

    get aabb(): FloatArrayParam {
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

    setVisible(viewIndex: number, visible: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setVisible(viewIndex, visible);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setXRayed(viewIndex: number, xrayed: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setXRayed(viewIndex, xrayed);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setHighlighted(viewIndex, highlighted);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setSelected(viewIndex: number, selected: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setSelected(viewIndex, selected);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setEdges(viewIndex: number, edges: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setEdges(viewIndex, edges);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setCulled(viewIndex: number, culled: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setCulled(viewIndex, culled);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setClippable(viewIndex: number, clippable: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setClippable(viewIndex, clippable);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setCollidable(viewIndex: number, collidable: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setCollidable(viewIndex, collidable);
        }
    }

    setPickable(viewIndex: number, pickable: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setPickable(viewIndex, pickable);
        }
    }

    setColorize(viewIndex: number, colorize: FloatArrayParam): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setColorize(viewIndex, colorize);
        }
    }

    setOpacity(viewIndex: number, opacity: number): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setOpacity(viewIndex, opacity);
        }
    }

    createTransform(transformParams: TransformParams): void {
        if (this.destroyed) {
            throw new Error("ViewerModel already destroyed");
        }
        if (this.built) {
            throw new Error("ViewerModel already built");
        }
    }

    createGeometry(geometryParams: GeometryParams): void {
        if (this.destroyed) {
            throw new Error("ViewerModel already destroyed");
        }
        if (this.built) {
            throw new Error("ViewerModel already built");
        }
        if (!geometryParams) {
            this.error("[createGeometry] Parameters expected: geometryParams");
            return;
        }
        const geometryId = geometryParams.id;
        if (this.geometries[geometryId]) {
            this.error(`[createGeometry] Geometry with this ID was already created: ${geometryId}`);
            return;
        }
        const primitive = geometryParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            this.error(`[createGeometry] Unsupported value for 'primitive': '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
            return;
        }
        if (!geometryParams.positions) {
            this.error("[createGeometry] Param expected: `positions`");
            return;
        }
        if (!geometryParams.indices && primitive !== PointsPrimitive) {
            this.error(`[createGeometry] Param expected: indices (required for primitive type)`);
            return;
        }
        this.geometries[geometryId] = new GeometryImpl(<GeometryCompressedParams>compressGeometryParams(geometryParams));
        this.#numGeometries++;
    }

    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): void {
        if (this.destroyed) {
            throw new Error("ViewerModel already destroyed");
        }
        if (this.built) {
            throw new Error("ViewerModel already built");
        }
        const geometryId = geometryCompressedParams.id;
        if (this.geometries[geometryId]) {
            this.error(`[createGeometryCompressed] Geometry with this ID already created: ${geometryId}`);
            return;
        }
        const primitive = geometryCompressedParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            this.error(`[createGeometryCompressed] Unsupported value for 'primitive': '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
            return;
        }
        this.geometries[geometryId] = new GeometryImpl(geometryCompressedParams);
        this.#numGeometries++;
    }

    createTexture(textureParams: TextureParams): void {
        if (this.destroyed) {
            throw new Error("ViewerModel already destroyed");
        }
        if (this.built) {
            throw new Error("ViewerModel already built");
        }
        const textureId = textureParams.id;
        if (textureId === undefined || textureId === null) {
            this.error("[createTexture] Config missing: id");
            return;
        }
        if (this.textures[textureId]) {
            this.error("[createTexture] Texture already created: " + textureId);
            return;
        }
        if (!textureParams.src && !textureParams.image && !textureParams.buffers) {
            this.error("[createTexture] Param expected: `src`, `image' or 'buffers'");
            return;
        }
        let minFilter = textureParams.minFilter || LinearMipmapLinearFilter;
        if (minFilter !== LinearFilter &&
            minFilter !== LinearMipMapNearestFilter &&
            minFilter !== LinearMipmapLinearFilter &&
            minFilter !== NearestMipMapLinearFilter &&
            minFilter !== NearestMipMapNearestFilter) {
            this.error(`[createTexture] Unsupported value for 'minFilter' - 
            supported values are LinearFilter, LinearMipMapNearestFilter, NearestMipMapNearestFilter, 
            NearestMipMapLinearFilter and LinearMipmapLinearFilter. Defaulting to LinearMipmapLinearFilter.`);
            minFilter = LinearMipmapLinearFilter;
        }
        let magFilter = textureParams.magFilter || LinearFilter;
        if (magFilter !== LinearFilter && magFilter !== NearestFilter) {
            this.error(`[createTexture] Unsupported value for 'magFilter' - supported values are LinearFilter and NearestFilter. Defaulting to LinearFilter.`);
            magFilter = LinearFilter;
        }
        let wrapS = textureParams.wrapS || RepeatWrapping;
        if (wrapS !== ClampToEdgeWrapping && wrapS !== MirroredRepeatWrapping && wrapS !== RepeatWrapping) {
            this.error(`[createTexture] Unsupported value for 'wrapS' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapS = RepeatWrapping;
        }
        let wrapT = textureParams.wrapT || RepeatWrapping;
        if (wrapT !== ClampToEdgeWrapping && wrapT !== MirroredRepeatWrapping && wrapT !== RepeatWrapping) {
            this.error(`[createTexture] Unsupported value for 'wrapT' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapT = RepeatWrapping;
        }
        let wrapR = textureParams.wrapR || RepeatWrapping;
        if (wrapR !== ClampToEdgeWrapping && wrapR !== MirroredRepeatWrapping && wrapR !== RepeatWrapping) {
            this.error(`[createTexture] Unsupported value for 'wrapR' - supported values are ClampToEdgeWrapping, MirroredRepeatWrapping and RepeatWrapping. Defaulting to RepeatWrapping.`);
            wrapR = RepeatWrapping;
        }
        let encoding = textureParams.encoding || LinearEncoding;
        if (encoding !== LinearEncoding && encoding !== sRGBEncoding) {
            this.error("[createTexture] Unsupported value for 'encoding' - supported values are LinearEncoding and sRGBEncoding. Defaulting to LinearEncoding.");
            encoding = LinearEncoding;
        }
        const texture = new Texture2D({gl: this.#renderContext.gl});
        if (textureParams.preloadColor) {
            texture.setPreloadColor(textureParams.preloadColor);
        }
        if (textureParams.image) { // Ignore transcoder for Images
            const image = textureParams.image;
            image.crossOrigin = "Anonymous";
            texture.setImage(image, {minFilter, magFilter, wrapS, wrapT, wrapR, flipY: textureParams.flipY, encoding});

        } else if (textureParams.src) {
            const ext = textureParams.src.split('.').pop();
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
                            flipY: textureParams.flipY,
                            encoding
                        });
                    };
                    image.src = textureParams.src; // URL or Base64 string
                    break;
                default: // Assume other file types need transcoding
                    if (!this.#textureTranscoder) {
                        this.error(`Can't create texture from 'src' - ViewerModel needs to be configured with a TextureTranscoder for this file type ('${ext}')`);
                    } else {
                        loadArraybuffer(textureParams.src, (arrayBuffer: ArrayBuffer) => {
                                if (!arrayBuffer.byteLength) {
                                    this.error(`Can't create texture from 'src': file data is zero length`);
                                    return;
                                }
                                this.#textureTranscoder.transcode([arrayBuffer]).then((compressedTextureData) => {
                                    texture.setCompressedData(compressedTextureData);
                                    this.#webglRenderer.setImageDirty();
                                });
                            },
                            (errMsg: string) => {
                                this.error(`Can't create texture from 'src': ${errMsg}`);
                            });
                    }
                    break;
            }
        } else if (textureParams.buffers) { // Buffers implicitly require transcoding
            if (!this.#textureTranscoder) {
                this.error(`Can't create texture from 'buffers' - ViewerModel needs to be configured with a TextureTranscoder for this option`);
            } else {
                this.#textureTranscoder.transcode(textureParams.buffers).then((compressedTextureData) => {
                    texture.setCompressedData(compressedTextureData);
                    this.#webglRenderer.setImageDirty();
                });
            }
        }
        this.textures[textureId] = new TextureImpl(textureParams, texture);
    }

    createTextureSet(textureSetParams: TextureSetParams): void {
        if (this.destroyed) {
            throw new Error("ViewerModel already destroyed");
        }
        if (this.built) {
            throw new Error("ViewerModel already built");
        }
        const textureSetId = textureSetParams.id;
        if (textureSetId === undefined || textureSetId === null) {
            this.error("Config missing: id");
            return;
        }
        if (this.textureSets[textureSetId]) {
            this.error(`Texture set already created: ${textureSetId}`);
            return;
        }
        let colorTexture;
        if (textureSetParams.colorTextureId !== undefined && textureSetParams.colorTextureId !== null) {
            colorTexture = this.textures[textureSetParams.colorTextureId];
            if (!colorTexture) {
                this.error(`Texture not found: ${textureSetParams.colorTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            colorTexture = this.textures[defaultColorTextureId];
        }
        let metallicRoughnessTexture;
        if (textureSetParams.metallicRoughnessTextureId !== undefined && textureSetParams.metallicRoughnessTextureId !== null) {
            metallicRoughnessTexture = this.textures[textureSetParams.metallicRoughnessTextureId];
            if (!metallicRoughnessTexture) {
                this.error(`Texture not found: ${textureSetParams.metallicRoughnessTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            metallicRoughnessTexture = this.textures[defaultMetalRoughTextureId];
        }
        let normalsTexture;
        if (textureSetParams.normalsTextureId !== undefined && textureSetParams.normalsTextureId !== null) {
            normalsTexture = this.textures[textureSetParams.normalsTextureId];
            if (!normalsTexture) {
                this.error(`Texture not found: ${textureSetParams.normalsTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            normalsTexture = this.textures[defaultNormalsTextureId];
        }
        let emissiveTexture;
        if (textureSetParams.emissiveTextureId !== undefined && textureSetParams.emissiveTextureId !== null) {
            emissiveTexture = this.textures[textureSetParams.emissiveTextureId];
            if (!emissiveTexture) {
                this.error(`Texture not found: ${textureSetParams.emissiveTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            emissiveTexture = this.textures[defaultEmissiveTextureId];
        }
        let occlusionTexture;
        if (textureSetParams.occlusionTextureId !== undefined && textureSetParams.occlusionTextureId !== null) {
            occlusionTexture = this.textures[textureSetParams.occlusionTextureId];
            if (!occlusionTexture) {
                this.error(`Texture not found: ${textureSetParams.occlusionTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            occlusionTexture = this.textures[defaultOcclusionTextureId];
        }
        this.textureSets[textureSetId] = new TextureSetImpl({
            id: textureSetId,
            colorTexture,
            metallicRoughnessTexture,
            emissiveTexture,
            occlusionTexture
        });
    }

    createMesh(meshParams: MeshParams): void {
        if (this.destroyed) {
            throw new Error("ViewerModel already destroyed");
        }
        if (this.built) {
            throw new Error("ViewerModel already built");
        }
        if (meshParams.geometryId === null || meshParams.geometryId === undefined) {
            this.error("Parameter expected: meshParams.geometryId");
            return;
        }
        const geometry = this.geometries[meshParams.geometryId];
        if (!geometry) {
            this.error(`[createMesh] Geometry not found: ${meshParams.geometryId}`);
            return;
        }

        const textureSet = (meshParams.textureSetId) ? this.textureSets[meshParams.textureSetId] : null;
        if (meshParams.textureSetId && !textureSet) {
            this.error(`[createMesh] TextureSet not found: ${meshParams.textureSetId}`);
            return;
        }

        const origin = tempVec3a;

        origin[0] = this.#origin[0];
        origin[1] = this.#origin[1];
        origin[2] = this.#origin[2];

        // if (geometry.origin) {
        //     origin[0] += geometry.origin[0];
        //     origin[1] += geometry.origin[1];
        //     origin[2] += geometry.origin[2];
        // }

        if (meshParams.origin) {
            origin[0] += meshParams.origin[0];
            origin[1] += meshParams.origin[1];
            origin[2] += meshParams.origin[2];
        }

        const layer = this.#getLayer(origin, meshParams.textureSetId, geometry);

        if (!layer) {
            return;
        }

        if (!layer.hasGeometry(meshParams.geometryId)) {
            layer.createGeometryCompressed(geometry)
        }

        let meshMatrix;
        let worldMatrix = this.#worldMatrixNonIdentity ? this.#worldMatrix : null;
        if (meshParams.matrix) {
            meshMatrix = meshParams.matrix;
        } else {
            const scale = meshParams.scale || defaultScale;
            const position = meshParams.position || defaultPosition;
            const rotation = meshParams.rotation || defaultRotation;
            eulerToQuaternion(rotation, "XYZ", defaultQuaternion);
            meshMatrix = composeMat4(position, defaultQuaternion, scale, tempMat4);
        }

        const color = (meshParams.color) ? new Uint8Array([Math.floor(meshParams.color[0] * 255), Math.floor(meshParams.color[1] * 255), Math.floor(meshParams.color[2] * 255)]) : [255, 255, 255];
        const opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? Math.floor(meshParams.opacity * 255) : 255;
        const metallic = (meshParams.metallic !== undefined && meshParams.metallic !== null) ? Math.floor(meshParams.metallic * 255) : 0;
        const roughness = (meshParams.roughness !== undefined && meshParams.roughness !== null) ? Math.floor(meshParams.roughness * 255) : 255;

        const mesh = new MeshImpl({
            id: meshParams.id,
            layer,
            color,
            opacity,
            matrix: meshMatrix,
            metallic,
            roughness,
            textureSet,
            geometry,
            meshIndex: 0
        });

        mesh.pickId = this.#webglRenderer.registerPickable(mesh);

        const a = mesh.pickId >> 24 & 0xFF;
        const b = mesh.pickId >> 16 & 0xFF;
        const g = mesh.pickId >> 8 & 0xFF;
        const r = mesh.pickId & 0xFF;

        const pickColor = new Uint8Array([r, g, b, a]); // Quantized pick color
        collapseAABB3(mesh.aabb);

        const meshIndex = layer.createMesh(<MeshParams>{
            id: meshParams.id,
            geometryId: meshParams.geometryId,
            color,
            opacity,
            metallic,
            roughness,
            matrix: meshMatrix,
            //     worldMatrix: worldMatrix,
            //    aabb: mesh.aabb,
            pickColor
        });
        this.#numGeometries++;
        expandAABB3(this.#aabb, mesh.aabb);
        mesh.layer = layer;
        mesh.meshIndex = meshIndex;
        this.#meshes[meshParams.id] = mesh;
    }

    createObject(objectParams: ObjectParams): void {
        if (this.destroyed) {
            throw new Error("ViewerModel already destroyed");
        }
        if (this.built) {
            throw new Error("ViewerModel already built");
        }
        let objectId = objectParams.id;
        if (objectId === undefined) {
            objectId = createUUID();
        } else if (this.objects[objectId]) {
            this.error("[createObject] ViewerModel already has a ViewerObject with this ID: " + objectId + " - will assign random ID");
            objectId = createUUID();
        }
        const meshIds = objectParams.meshIds;
        if (meshIds === undefined) {
            throw new Error("[createObject] Param expected: meshIds");
        }
        let meshes = [];
        for (let i = 0, len = meshIds.length; i < len; i++) {
            const meshId = meshIds[i];
            const mesh = this.#meshes[meshId];
            if (!mesh) {
                this.error("Mesh with this ID not found: " + meshId + " - ignoring this mesh");
                continue;
            }
            if (mesh.viewerObject) {
                this.error("Mesh with ID " + meshId + " already belongs to object with ID " + mesh.viewerObject.id + " - ignoring this mesh");
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
        const viewerObject: ViewerObjectImpl = new ViewerObjectImpl({
            id: objectId,
            viewerModel: this,
            meshes,
            aabb,
            viewLayerId: (objectParams.viewLayerId || this.#viewLayerId)
        });
        this.objectList.push(viewerObject);
        this.objects[objectId] = viewerObject;
        this.#numViewerObjects++;
    }

    build() {
        if (this.destroyed) {
            this.log("ViewerModel already destroyed");
            return;
        }
        if (this.built) {
            this.log("ViewerModel already built");
            return;
        }
        for (let layerId in this.#currentLayers) {
            if (this.#currentLayers.hasOwnProperty(layerId)) {
                this.#currentLayers[layerId].build();
            }
        }
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            const viewerObject = this.objectList[i];
            viewerObject.build();
        }
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            const viewerObject = this.objectList[i];
            viewerObject.finalize2();
        }
        // this.layerList.sort((a, b) => {
        //     if (a.sortId < b.sortId) {
        //         return -1;
        //     }
        //     if (a.sortId > b.sortId) {
        //         return 1;
        //     }
        //     return 0;
        // });
        for (let i = 0, len = this.layerList.length; i < len; i++) {
            const layer = this.layerList[i];
            layer.layerIndex = i;
        }
        this.#currentLayers = {};
        this.built = true;
        this.#webglRenderer.setImageDirty();
        this.#view.viewer.setAABBDirty();
        this.onBuilt.dispatch(this, null);
    }

    /*
    rebuildDrawFlags() {
        this.drawFlags.reset();
        this.#updateDrawFlagsVisibleLayers();
        if (this.drawFlags.numLayers > 0 && this.drawFlags.numVisibleLayers === 0) {
            this.drawFlags.culled = true;
            return;
        }
        this.#updateDrawFlags();
    }

    drawColorOpaque(renderContext: RenderContext): void {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawColorOpaque(drawFlags, renderContext);
        }
    }

    drawColorTransparent(renderContext: RenderContext): void {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawColorTransparent(drawFlags, renderContext);
        }
    }

    drawDepth(renderContext: RenderContext): void { // Dedicated to SAO because it skips transparent objects
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawDepth(drawFlags, renderContext);
        }
    }

    drawNormals(renderContext: RenderContext): void { // Dedicated to SAO because it skips transparent objects
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawNormals(drawFlags, renderContext);
        }
    }

    drawSilhouetteXRayed(renderContext: RenderContext): void {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawSilhouetteXRayed(drawFlags, renderContext);
        }
    }

    drawSilhouetteHighlighted(renderContext: RenderContext): void {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawSilhouetteHighlighted(drawFlags, renderContext);
        }
    }

    drawSilhouetteSelected(renderContext: RenderContext): void {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawSilhouetteSelected(drawFlags, renderContext);
        }
    }

    drawEdgesColorOpaque(renderContext: RenderContext): void {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawEdgesColorOpaque(drawFlags, renderContext);
        }
    }

    drawEdgesColorTransparent(renderContext: RenderContext): void {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawEdgesColorTransparent(drawFlags, renderContext);
        }
    }

    drawEdgesXRayed(renderContext: RenderContext): void {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawEdgesXRayed(drawFlags, renderContext);
        }
    }

    drawEdgesHighlighted(renderContext: RenderContext) {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawEdgesHighlighted(drawFlags, renderContext);
        }
    }

    drawEdgesSelected(renderContext: RenderContext) {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawEdgesSelected(drawFlags, renderContext);
        }
    }

    drawOcclusion(renderContext: RenderContext) {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawOcclusion(drawFlags, renderContext);
        }
    }

    drawShadow(renderContext: RenderContext) {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawShadow(drawFlags, renderContext);
        }
    }

    drawPickMesh(renderContext: RenderContext) {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawPickMesh(drawFlags, renderContext);
        }
    }

    drawPickDepths(renderContext: RenderContext) {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawPickDepths(drawFlags, renderContext);
        }
    }

    drawPickNormals(renderContext: RenderContext) {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        const drawFlags = this.drawFlags;
        for (let i = 0, len = drawFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = drawFlags.visibleLayers[i];
            this.layerList[layerIndex].drawPickNormals(drawFlags, renderContext);
        }
    }
*/
    destroy() {
        if (this.destroyed) {
            return;
        }
        this.#view.camera.onViewMatrix.unsubscribe(this.#onCameraViewMatrix);
        for (let layerId in this.#currentLayers) {
            if (this.#currentLayers.hasOwnProperty(layerId)) {
                this.#currentLayers[layerId].destroy();
            }
        }
        for (let i = 0, len = this.layerList.length; i < len; i++) {
            this.layerList[i].destroy();
        }
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].destroy();
        }
        for (let meshId in this.#meshes) {
            this.#webglRenderer.deregisterPickable(this.#meshes[meshId].pickId);
        }
        this.#currentLayers = {};
        this.#layers = {};
        this.layerList = [];
        this.geometries = {};
        this.textures = {};
        this.textureSets = {};
        this.#meshes = {};
        this.objects = {};
        this.#view.viewer.setAABBDirty();
        this.onBuilt.clear();
        super.destroy();
    }

    private collapseAABB3() {
        return undefined;
    }

    #createDefaultTextureSet() {
        const defaultColorTexture = new TextureImpl({
                id: defaultColorTextureId
            },
            new Texture2D({
                gl: this.#renderContext.gl,
                preloadColor: [1, 1, 1, 1] // [r, g, b, a]})
            }));


        const defaultMetalRoughTexture = new TextureImpl({
                id: defaultMetalRoughTextureId
            },
            new Texture2D({
                gl: this.#renderContext.gl,
                preloadColor: [0, 1, 1, 1] // [unused, roughness, metalness, unused]
            }));
        const defaultNormalsTexture = new TextureImpl({
                id: defaultNormalsTextureId
            },
            new Texture2D({
                gl: this.#renderContext.gl,
                preloadColor: [0, 0, 0, 0] // [x, y, z, unused] - these must be zeros
            }));

        const defaultEmissiveTexture = new TextureImpl({
                id: defaultEmissiveTextureId
            },
            new Texture2D({
                gl: this.#renderContext.gl,
                preloadColor: [0, 0, 0, 1] // [x, y, z, unused]
            }));
        const defaultOcclusionTexture = new TextureImpl({
                id: defaultOcclusionTextureId
            },
            new Texture2D({
                gl: this.#renderContext.gl,
                preloadColor: [1, 1, 1, 1] // [x, y, z, unused]
            }));
        this.textures[defaultColorTextureId] = defaultColorTexture;
        this.textures[defaultMetalRoughTextureId] = defaultMetalRoughTexture;
        this.textures[defaultNormalsTextureId] = defaultNormalsTexture;
        this.textures[defaultEmissiveTextureId] = defaultEmissiveTexture;
        this.textures[defaultOcclusionTextureId] = defaultOcclusionTexture;
        this.textureSets[defaultTextureSetId] = new TextureSetImpl({
            id: defaultTextureSetId,
            colorTexture: defaultColorTexture,
            metallicRoughnessTexture: defaultMetalRoughTexture,
            emissiveTexture: defaultEmissiveTexture,
            occlusionTexture: defaultOcclusionTexture
        });
    }

    #getLayer(origin: FloatArrayParam, textureSetId: string | undefined, geometryCompressedParams: GeometryCompressedParams): Layer | undefined {
        const layerId = `${origin[0]}_${origin[1]}_${origin[2]}_${textureSetId}_${geometryCompressedParams.primitive}`;
        let layer = this.#currentLayers[layerId];
        if (layer) {
            if (layer.canCreateMesh(geometryCompressedParams)) {
                return layer;
            } else {
                layer.build();
                delete this.#currentLayers[layerId];
            }
        }
        let textureSet;
        if (textureSetId) {
            textureSet = this.textureSets[textureSetId];
            if (!textureSet) {
                this.error(`TextureSet not found: ${textureSetId} - ensure that you create it first with createTextureSet()`);
                return;
            }
        }
        layer = new Layer(<LayerParams>{
            gl: this.#renderContext.gl,
            view: this.#view,
            viewerModel: this,
            primitive: geometryCompressedParams.primitive,
            origin,
            textureSet,
            layerIndex: 0
        });
        this.#layers[layerId] = layer;
        this.layerList.push(layer);
        this.#currentLayers[layerId] = layer;
        return layer;
    }

    #rebuildAABB() {
        collapseAABB3(this.#aabb);
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            const viewerObject = this.objectList[i];
            expandAABB3(this.#aabb, viewerObject.aabb);
        }
        this.#aabbDirty = false;
    }

    /*
        #getActiveSectionPlanesForLayer(layer: any) {
            const drawFlags = this.drawFlags;
            const sectionPlanes = this.#view.sectionPlanesList;
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
            drawFlags.numLayers = this.layerList.length;
            drawFlags.numVisibleLayers = 0;
            for (let layerIndex = 0, len = this.layerList.length; layerIndex < len; layerIndex++) {
                const layer = this.layerList[layerIndex];
                const layerVisible = this.#getActiveSectionPlanesForLayer(layer);
                if (layerVisible) {
                    drawFlags.visibleLayers[drawFlags.numVisibleLayers++] = layerIndex;
                }
            }
        }

        #updateDrawFlags() {
            if (this.meshCounts.numVisible === 0) {
                return;
            }
            if (this.meshCounts.numCulled === this.meshCounts.numMeshes) {
                return;
            }
            const drawFlags = this.drawFlags;
            drawFlags.colorOpaque = (this.meshCounts.numTransparent < this.meshCounts.numMeshes);
            if (this.meshCounts.numTransparent > 0) {
                drawFlags.colorTransparent = true;
            }
            if (this.meshCounts.numXRayed > 0) {
                const xrayMaterial = this.#view.xrayMaterial.state;
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
            if (this.meshCounts.numEdges > 0) {
                const edgeMaterial = this.#view.edgeMaterial.state;
                if (edgeMaterial.edges) {
                    drawFlags.edgesOpaque = (this.meshCounts.numTransparent < this.meshCounts.numMeshes);
                    if (this.meshCounts.numTransparent > 0) {
                        drawFlags.edgesTransparent = true;
                    }
                }
            }
            if (this.meshCounts.numSelected > 0) {
                const selectedMaterial = this.#view.selectedMaterial.state;
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
            if (this.meshCounts.numHighlighted > 0) {
                const highlightMaterial = this.#view.highlightMaterial.state;
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

     */
}



