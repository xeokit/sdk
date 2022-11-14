import {
    Component,
    Scene,
    View,
    SceneModel,
    Events,
    utils,
    math,
    GeometryParams,
    MeshParams,
    Renderer,
    SceneObjectParams,
    TextureParams,
    TextureSetParams,
    SceneObject,
    Transform,
    GeometryCompressedParams
} from "../../viewer/index";

import {getKTX2TextureTranscoder} from "../textureTranscoders/KTX2TextureTranscoder/KTX2TextureTranscoder";

import {Texture2D} from "../lib/Texture2D";
import {WebGLRenderer} from "../WebGLRenderer";
import {Layer, LayerParams} from "./Layer";
import {Mesh} from './Mesh';
import {TextureSet} from "./TextureSet";
import {Texture} from "./Texture";
import {WebGLSceneObject} from "./WebGLSceneObject";

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

import {MeshCounts} from "./MeshCounts";
import {compressGeometryParams} from "../../viewer/math/compression/compression";
import {TransformParams} from "../../viewer/scene/TransformParams";
import {TextureTranscoder} from "../textureTranscoders/TextureTranscoder";

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

export class WebGLSceneModel extends Component implements SceneModel {

    readonly qualityRender: boolean;
    declare readonly id: string;
    readonly view: View;
    readonly scene: Scene;
    declare readonly events: Events;
    declare readonly destroyed: boolean;
    objects: { [key: string]: WebGLSceneObject };
    objectList: WebGLSceneObject[];


    #renderer: Renderer;
    #webglRenderer: WebGLRenderer;

    #origin: math.FloatArrayType;
    #position: math.FloatArrayType;
    #rotation: math.FloatArrayType;
    #quaternion: math.FloatArrayType;
    #scale: math.FloatArrayType;
    #worldMatrix: math.FloatArrayType;
    #viewMatrix: math.FloatArrayType;

    #colorTextureEnabled: boolean;
    #backfaces: boolean;
    #geometries: { [key: string]: GeometryCompressedParams };
    #textures: { [key: string]: Texture };
    #textureSets: { [key: string]: TextureSet };
    #meshes: { [key: string]: Mesh };
    layerList: Layer[];
    #layers: { [key: string]: Layer };

    #numGeometries: number;
    #numTriangles: number;
    #numLines: number;
    #numPoints: number;
    #numSceneObjects: number;
    #textureTranscoder: any;
    #aabbDirty: boolean;
    #lastOrigin: math.FloatArrayType;
    #lastPositionsDecompressMatrix: math.FloatArrayType;
    #edgeThreshold: number;
    #lastmeshHadNormals: boolean;
    #currentLayers: { [key: string]: any };
    #aabb: math.FloatArrayType;
    #viewMatrixDirty: boolean;
    #worldMatrixNonIdentity: boolean;
    #onCameraViewMatrix: number;
    #finalized: boolean;

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
        textureTranscoder?: TextureTranscoder;
        qualityRender?: boolean;
    }) {

        super(params.view);

        this.events = new Events();

        this.id = params.id;
        this.scene = params.scene;
        this.view = params.view;
        this.objectList = [];

        this.#webglRenderer = params.webglRenderer;
        this.#renderer = params.webglRenderer;
        this.#textureTranscoder = params.textureTranscoder || getKTX2TextureTranscoder(this.scene.viewer);
        this.#aabb = math.boundaries.collapseAABB3();
        this.#aabbDirty = false;
        this.layerList = [];
        this.#lastOrigin = null;
        this.#lastPositionsDecompressMatrix = null;
        this.#lastmeshHadNormals = null;
        this.#currentLayers = {};
        this.#geometries = {};
        this.#textures = {};
        this.#textureSets = {};
        this.#meshes = {};
        this.#numGeometries = 0;
        this.#numSceneObjects = 0;

        this.#numTriangles = 0;
        this.#numLines = 0;
        this.#numPoints = 0;
        this.#edgeThreshold = params.edgeThreshold || 10;

        this.#finalized = false;

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

        if (params.matrix || params.position || params.rotation || params.scale || params.quaternion) {
            this.#viewMatrix = math.mat4();
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

    get viewMatrix(): math.FloatArrayType {
        if (!this.#viewMatrix) {
            return this.view.camera.viewMatrix;
        }
        if (this.#viewMatrixDirty) {
            math.mulMat4(this.view.camera.viewMatrix, this.#worldMatrix, this.#viewMatrix);
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

    setVisible(viewIndex: number, visible: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setVisible(viewIndex, visible);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setXRayed(viewIndex: number, xrayed: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setXRayed(viewIndex, xrayed);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setHighlighted(viewIndex, highlighted);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setSelected(viewIndex: number, selected: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setSelected(viewIndex, selected);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setEdges(viewIndex: number, edges: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setEdges(viewIndex, edges);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setCulled(viewIndex: number, culled: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setCulled(viewIndex, culled);
        }
        this.#renderer.setImageDirty(viewIndex);
    }

    setClippable(viewIndex: number, clippable: boolean): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setClippable(viewIndex, clippable);
        }
        this.#renderer.setImageDirty(viewIndex);
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

    setColorize(viewIndex: number, colorize: math.FloatArrayType): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setColorize(viewIndex, colorize);
        }
    }

    setOpacity(viewIndex: number, opacity: number): void {
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            this.objectList[i].setOpacity(viewIndex, opacity);
        }
    }

    createTransform(transformParams: TransformParams): Transform {
        return null;
    }

    createGeometry(geometryParams: GeometryParams): void {
        if (this.destroyed || this.#finalized) {
            return;
        }
        const geometryId = geometryParams.id;
        if (this.#geometries[geometryId]) {
            this.error(`[createGeometry] Geometry with this ID already created: ${geometryId}`);
            return;
        }
        const primitive = geometryParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            this.error(`[createGeometry] Unsupported value for 'primitive': '${primitive}'  ('geometryId' is absent) - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
            return;
        }
        if (!geometryParams.positions) {
            this.error("[createGeometry] Param expected: `positions`");
            return null;
        }
        if (!geometryParams.indices && primitive !== PointsPrimitive) {
            this.error(`[createGeometry] Param expected: indices (required for primitive type)`);
            return null;
        }
        this.#geometries[geometryId] = <GeometryCompressedParams>compressGeometryParams(geometryParams);
        this.#numGeometries++;
    }

    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): void {
        if (this.destroyed || this.#finalized) {
            return;
        }
        const geometryId = geometryCompressedParams.id;
        if (this.#geometries[geometryId]) {
            this.error(`[createGeometryCompressed] Geometry with this ID already created: ${geometryId}`);
            return;
        }
        const primitive = geometryCompressedParams.primitive;
        if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
            this.error(`[createGeometryCompressed] Unsupported value for 'primitive': '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
            return;
        }
        this.#geometries[geometryId] = geometryCompressedParams;
        this.#numGeometries++;
    }

    createTexture(textureParams: TextureParams): void {
        if (this.destroyed || this.#finalized) {
            return;
        }
        const textureId = textureParams.id;
        if (textureId === undefined || textureId === null) {
            this.error("[createTexture] Config missing: id");
            return;
        }
        if (this.#textures[textureId]) {
            this.error("[createTexture] Texture already created: " + textureId);
            return;
        }
        if (!textureParams.src && !textureParams.image && !textureParams.buffers) {
            this.error("[createTexture] Param expected: `src`, `image' or 'buffers'");
            return null;
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
        const texture = new Texture2D({gl: this.#webglRenderer.gl});
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
                        this.error(`Can't create texture from 'src' - SceneModel needs to be configured with a TextureTranscoder for this file type ('${ext}')`);
                    } else {
                        utils.loadArraybuffer(textureParams.src, (arrayBuffer: ArrayBuffer) => {
                                if (!arrayBuffer.byteLength) {
                                    this.error(`Can't create texture from 'src': file data is zero length`);
                                    return;
                                }
                                this.#textureTranscoder.transcode([arrayBuffer], texture).then(() => {
                                    this.#renderer.setImageDirty();
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
                this.error(`Can't create texture from 'buffers' - SceneModel needs to be configured with a TextureTranscoder for this option`);
            } else {
                this.#textureTranscoder.transcode(textureParams.buffers, texture).then(() => {
                    this.#renderer.setImageDirty();
                });
            }
        }
        this.#textures[textureId] = new Texture({id: textureId, texture});
    }

    createTextureSet(textureSetParams: TextureSetParams): void {
        if (this.destroyed || this.#finalized) {
            return;
        }
        const textureSetId = textureSetParams.id;
        if (textureSetId === undefined || textureSetId === null) {
            this.error("Config missing: id");
            return;
        }
        if (this.#textureSets[textureSetId]) {
            this.error(`Texture set already created: ${textureSetId}`);
            return;
        }
        let colorTexture;
        if (textureSetParams.colorTextureId !== undefined && textureSetParams.colorTextureId !== null) {
            colorTexture = this.#textures[textureSetParams.colorTextureId];
            if (!colorTexture) {
                this.error(`Texture not found: ${textureSetParams.colorTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            colorTexture = this.#textures[defaultColorTextureId];
        }
        let metallicRoughnessTexture;
        if (textureSetParams.metallicRoughnessTextureId !== undefined && textureSetParams.metallicRoughnessTextureId !== null) {
            metallicRoughnessTexture = this.#textures[textureSetParams.metallicRoughnessTextureId];
            if (!metallicRoughnessTexture) {
                this.error(`Texture not found: ${textureSetParams.metallicRoughnessTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            metallicRoughnessTexture = this.#textures[defaultMetalRoughTextureId];
        }
        let normalsTexture;
        if (textureSetParams.normalsTextureId !== undefined && textureSetParams.normalsTextureId !== null) {
            normalsTexture = this.#textures[textureSetParams.normalsTextureId];
            if (!normalsTexture) {
                this.error(`Texture not found: ${textureSetParams.normalsTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            normalsTexture = this.#textures[defaultNormalsTextureId];
        }
        let emissiveTexture;
        if (textureSetParams.emissiveTextureId !== undefined && textureSetParams.emissiveTextureId !== null) {
            emissiveTexture = this.#textures[textureSetParams.emissiveTextureId];
            if (!emissiveTexture) {
                this.error(`Texture not found: ${textureSetParams.emissiveTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            emissiveTexture = this.#textures[defaultEmissiveTextureId];
        }
        let occlusionTexture;
        if (textureSetParams.occlusionTextureId !== undefined && textureSetParams.occlusionTextureId !== null) {
            occlusionTexture = this.#textures[textureSetParams.occlusionTextureId];
            if (!occlusionTexture) {
                this.error(`Texture not found: ${textureSetParams.occlusionTextureId} - ensure that you create it first with createTexture()`);
                return;
            }
        } else {
            occlusionTexture = this.#textures[defaultOcclusionTextureId];
        }
        this.#textureSets[textureSetId] = new TextureSet({
            id: textureSetId,
            colorTexture,
            metallicRoughnessTexture,
            normalsTexture,
            emissiveTexture,
            occlusionTexture
        });
    }

    createMesh(meshParams: MeshParams): void {
        if (this.destroyed || this.#finalized) {
            return;
        }
        const geometryCompressedParams = this.#geometries[meshParams.geometryId];
        if (!geometryCompressedParams) {
            this.error(`[ceateMesh] Geometry not found: ${meshParams.geometryId}`);
            return;
        }

        const origin = (meshParams.origin) ? math.addVec3(this.#origin, meshParams.origin, tempVec3a) : this.#origin;

        const layer = this.#getLayer(origin, meshParams.textureSetId, geometryCompressedParams);

        if (!layer.hasGeometry(meshParams.geometryId)) {
            layer.createGeometry(geometryCompressedParams)
        }

        const color = (meshParams.color) ? new Uint8Array([Math.floor(meshParams.color[0] * 255), Math.floor(meshParams.color[1] * 255), Math.floor(meshParams.color[2] * 255)]) : [255, 255, 255];
        const opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? Math.floor(meshParams.opacity * 255) : 255;
        const metallic = (meshParams.metallic !== undefined && meshParams.metallic !== null) ? Math.floor(meshParams.metallic * 255) : 0;
        const roughness = (meshParams.roughness !== undefined && meshParams.roughness !== null) ? Math.floor(meshParams.roughness * 255) : 255;

        const mesh = new Mesh({id: meshParams.id, color, opacity});

        mesh.pickId = this.#webglRenderer.registerPickable(mesh);

        const a = mesh.pickId >> 24 & 0xFF;
        const b = mesh.pickId >> 16 & 0xFF;
        const g = mesh.pickId >> 8 & 0xFF;
        const r = mesh.pickId & 0xFF;

        const pickColor = new Uint8Array([r, g, b, a]); // Quantized pick color
        math.boundaries.collapseAABB3(mesh.aabb);
        let meshMatrix;
        let worldMatrix = this.#worldMatrixNonIdentity ? this.#worldMatrix : null;
        if (meshParams.matrix) {
            meshMatrix = meshParams.matrix;
        } else {
            const scale = meshParams.scale || defaultScale;
            const position = meshParams.position || defaultPosition;
            const rotation = meshParams.rotation || defaultRotation;
            math.eulerToQuaternion(rotation, "XYZ", defaultQuaternion);
            meshMatrix = math.composeMat4(position, defaultQuaternion, scale, tempMat4);
        }
        const meshId = layer.createMesh(<MeshParams>{
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
        mesh.origin = origin;
        this.#numGeometries++;
        math.boundaries.expandAABB3(this.#aabb, mesh.aabb);
        mesh.sceneObject = null;
        mesh.layer = layer;
        mesh.meshId = meshId;
        this.#meshes[meshParams.id] = mesh;
    }

    createObject(sceneObjectParams: SceneObjectParams): SceneObject {
        if (this.destroyed || this.#finalized) {
            return;
        }
        let id = sceneObjectParams.id;
        if (id === undefined) {
            id = utils.createUUID();
        } else if (this.objects[id]) {
            this.error("[createObject] SceneModel already has a SceneObject with this ID: " + id + " - will assign random ID");
            id = utils.createUUID();
        }
        const meshIds = sceneObjectParams.meshIds;
        if (meshIds === undefined) {
            this.error("[createObject] Param expected: meshIds");
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
            aabb = math.boundaries.collapseAABB3();
            for (let i = 0, len = meshes.length; i < len; i++) {
                math.boundaries.expandAABB3(aabb, meshes[i].aabb);
            }
        }
        const sceneObject: WebGLSceneObject = new WebGLSceneObject({
            id,
            sceneModel: this,
            meshes,
            aabb
        });
        this.objectList.push(sceneObject);
        this.objects[id] = sceneObject;
        this.#numSceneObjects++;
        return sceneObject;
    }

    finalize() {
        if (this.destroyed || this.#finalized) {
            return;
        }
        for (let layerId in this.#currentLayers) {
            if (this.#currentLayers.hasOwnProperty(layerId)) {
                this.#currentLayers[layerId].finalize();
            }
        }
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            const sceneObject = this.objectList[i];
            sceneObject.finalize();
        }
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            const sceneObject = this.objectList[i];
            sceneObject.finalize2();
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
        this.#renderer.setImageDirty();
        this.scene.setAABBDirty();
        this.events.fire("finalized", {});
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
        this.events.fire("destroyed", {}); // Fire this first
        this.view.camera.events.off(this.#onCameraViewMatrix);
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
        this.#geometries = {};
        this.#textures = {};
        this.#textureSets = {};
        this.#meshes = {};
        this.objects = {};
        this.scene.setAABBDirty();
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

    #getLayer(origin: math.FloatArrayType, textureSetId: string, geometryCompressedParams: GeometryCompressedParams): Layer {
        const layerId = `${origin[0]}.${origin[1]}.${origin[2]}.${textureSetId}.${geometryCompressedParams.primitive}`;
        let layer = this.#currentLayers[layerId];
        if (layer) {
            if (layer.canCreateMesh(geometryCompressedParams)) {
                return layer;
            } else {
                layer.finalize();
                delete this.#currentLayers[layerId];
            }
        }
        let textureSet;
        if (textureSetId !== undefined) {
            textureSet = this.#textureSets[textureSetId];
            if (!textureSet) {
                this.error(`TextureSet not found: ${textureSetId} - ensure that you create it first with createTextureSet()`);
                return;
            }
        }
        layer = new Layer(<LayerParams>{
            gl: this.#webglRenderer.gl,
            view:this.view,
            sceneModel: this,
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
        math.boundaries.collapseAABB3(this.#aabb);
        for (let i = 0, len = this.objectList.length; i < len; i++) {
            const sceneObject = this.objectList[i];
            math.boundaries.expandAABB3(this.#aabb, sceneObject.aabb);
        }
        this.#aabbDirty = false;
    }
/*
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
        if (this.meshCounts.numEdges > 0) {
            const edgeMaterial = this.view.edgeMaterial.state;
            if (edgeMaterial.edges) {
                drawFlags.edgesOpaque = (this.meshCounts.numTransparent < this.meshCounts.numMeshes);
                if (this.meshCounts.numTransparent > 0) {
                    drawFlags.edgesTransparent = true;
                }
            }
        }
        if (this.meshCounts.numSelected > 0) {
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
        if (this.meshCounts.numHighlighted > 0) {
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

 */
}

