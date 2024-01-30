import {Component, EventEmitter, SDKError, type TextureTranscoder} from "@xeokit/core";
import {createUUID, loadArraybuffer} from "@xeokit/utils";
import {collapseAABB3, expandAABB3} from "@xeokit/boundaries";
import {composeMat4, createMat4, createVec3, createVec4, eulerToQuat, identityQuat, mulMat4} from "@xeokit/matrix";

import type {FloatArrayParam} from "@xeokit/math";
import type {Camera, View, Viewer} from "@xeokit/viewer";
import {WebGLTexture} from "@xeokit/webglutils";
import type {
    RendererGeometry,
    RendererMesh,
    RendererModel,
    RendererTexture,
    RendererTextureSet,
    SceneGeometry,
    SceneGeometryCompressedParams,
    SceneMesh,
    SceneModel,
    SceneObject,
    SceneTexture,
    SceneTextureSet
} from "@xeokit/scene";
import type {WebGLRenderer} from "./WebGLRenderer";
import {TrianglesLayer} from "./triangles/TrianglesLayer";
import type {RenderContext} from "./RenderContext";
import {WebGLRendererGeometry} from "./WebGLRendererGeometry";

import {WebGLRendererTexture} from "./WebGLRendererTexture";
import {WebGLRendererObject} from "./WebGLRendererObject";
import {WebGLRendererMesh} from "./WebGLRendererMesh";
import {WebGLRendererTextureSet} from "./WebGLRendererTextureSet";
import type {LayerParams} from "./LayerParams";
import type {WebGLTileManager} from "./WebGLTileManager";
import {MeshCounts} from "./MeshCounts";
import {Layer} from "./Layer";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "@xeokit/constants";

const defaultScale = createVec3([1, 1, 1]);
const defaultPosition = createVec3([0, 0, 0]);
const defaultRotation = createVec3([0, 0, 0]);
const defaultQuaternion = identityQuat();

const defaultColorTextureId = "defaultColorTexture";
const defaultMetalRoughTextureId = "defaultMetalRoughTexture";
const defaultNormalsTextureId = "defaultNormalsTexture";
const defaultEmissiveTextureId = "defaultEmissiveTexture";
const defaultOcclusionTextureId = "defaultOcclusionTexture";
const defaultTextureSetId = "defaultTextureSet";

/**
 * @private
 */
export class WebGLRendererModel extends Component implements RendererModel {

    declare readonly id: string;
    readonly viewer: Viewer;
    sceneModel: SceneModel | null;
    readonly qualityRender: boolean;
    declare readonly destroyed: boolean;

    rendererGeometries: { [key: string]: RendererGeometry };
    rendererTextures: { [key: string]: RendererTexture };
    rendererTextureSets: { [key: string]: RendererTextureSet; };
    rendererMeshes: { [key: string]: WebGLRendererMesh };
    rendererObjects: { [key: string]: WebGLRendererObject };
    rendererObjectsList: WebGLRendererObject[];

    layerList: Layer[];
    #layers: { [key: string]: Layer };
    #currentLayers: { [key: string]: any };

    meshCounts: MeshCounts;

    declare readonly onDestroyed: EventEmitter<Component, null>;

    #view: View;
    #webglRenderer: WebGLRenderer;
    #renderContext: RenderContext;
    #position: FloatArrayParam;
    #rotation: FloatArrayParam;
    #quaternion: FloatArrayParam;
    #scale: FloatArrayParam;
    #worldMatrix: FloatArrayParam;
    #viewMatrix: FloatArrayParam;
    #colorTextureEnabled: boolean;
    #backfaces: boolean;
    #numGeometries: number;
    #numTextures: number;
    #numMeshes: number;
    #numTriangles: number;
    #numLines: number;
    #numPoints: number;
    #numRendererObjects: number;
    #textureTranscoder: TextureTranscoder;
    #aabbDirty: boolean;
    #edgeThreshold: number;
    #aabb: FloatArrayParam;
    #viewMatrixDirty: boolean;
    #worldMatrixNonIdentity: boolean;
    #onCameraViewMatrix: () => void;
    #layerId: string | undefined;

    numSubMeshes: number;

    constructor(params: {
        id: string;
        sceneModel: SceneModel;
        matrix?: FloatArrayParam;
        scale?: FloatArrayParam;
        view: View;
        webglRenderer: WebGLRenderer;
        renderContext: RenderContext;
        quaternion?: FloatArrayParam;
        rotation?: FloatArrayParam;
        position?: FloatArrayParam;
        edgeThreshold?: number;
        textureTranscoder: TextureTranscoder;
        qualityRender?: boolean;
        layerId?: string;
    }) {

        super(params.view);

        this.id = params.id;
        this.sceneModel = params.sceneModel
        this.viewer = params.view.viewer;

        this.meshCounts = new MeshCounts();

        this.#view = params.view;
        this.#webglRenderer = params.webglRenderer;
        this.#renderContext = params.renderContext;
        this.#textureTranscoder = params.textureTranscoder;

        this.#aabb = collapseAABB3();
        this.#aabbDirty = false;
        this.#layers = {};
        this.layerList = [];
        this.#currentLayers = {};

        this.rendererGeometries = {};
        this.rendererTextures = {};
        this.rendererTextureSets = {};
        this.rendererMeshes = {};
        this.rendererObjects = {};
        this.rendererObjectsList = [];

        this.rendererObjects = {};

        this.#numGeometries = 0;
        this.#numRendererObjects = 0;
        this.#numTextures = 0;
        this.#numMeshes = 0;

        this.#numTriangles = 0;
        this.#numLines = 0;
        this.#numPoints = 0;
        this.#edgeThreshold = params.edgeThreshold || 10;

        this.numSubMeshes = 0;

        // Build static matrix

        this.#position = createVec3(params.position || [0, 0, 0]);
        this.#rotation = createVec3(params.rotation || [0, 0, 0]);
        this.#quaternion = createVec4(params.quaternion || [0, 0, 0, 1]);
        if (params.rotation) {
            eulerToQuat(this.#rotation, "XYZ", this.#quaternion);
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

        this.#layerId = params.layerId;

        this.#onCameraViewMatrix = this.#view.camera.onViewMatrix.subscribe((camera: Camera, viewMatrix: FloatArrayParam) => {
            this.#viewMatrixDirty = true;
        });

        this.#createDefaultTextureSet();

        this.#attachSceneModel(params.sceneModel);

        for (let i = 0, len = this.layerList.length; i < len; i++) {
            const layer = this.layerList[i];
            layer.layerIndex = i;
        }
        this.#currentLayers = {};
        this.#build();
        this.#webglRenderer.setImageDirty();
        //     this.#view.viewer.scene.setAABBDirty();
    }

    #attachSceneModel(sceneModel: SceneModel): void {
        const textures = sceneModel.textures;
        const geometries = sceneModel.geometries;
        const meshes = sceneModel.meshes;
        const objects = sceneModel.objects;
        if (textures) {
            for (let textureId in textures) {
                this.#attachTexture(textures[textureId]);
            }
        }
        if (geometries) {
            for (let geometryId in geometries) {
                this.#attachGeometry(geometries[geometryId]);
            }
        }
        if (meshes) {
            for (let meshId in meshes) {
                this.#attachMesh(meshes[meshId]);
            }
        }
        if (objects) {
            for (let objectId in objects) {
                this.#attachSceneObject(objects[objectId]);
            }
        }
        for (let layerId in this.#currentLayers) {
            this.#currentLayers[layerId].build();
        }
        // Do a two-step commit and flush of all the flags and material attributes
        // managed by the RendererObjects into their Layers. This enables efficient
        // upload of that state into the data textures managed by those Layers. First
        // step populates the data arrays for the data textures, second step loads the
        // entire arrays into the textures, collapsing zillions of gl.texSubImage2D calls.
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].uploadRendererState();
        }
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].commitRendererState();
        }
    }

    #attachTexture(texture: SceneTexture): void {
        // Attaches a WebGLRendererTexture to the given SceneTexture
        const textureId = texture.id;
        if (this.rendererTextures[textureId]) {
            throw new SDKError(`WebGLRendererTexture with ID ${textureId} already created in WebGLRendererModel`);
        }
        const glTexture = new WebGLTexture({gl: this.#renderContext.gl});
        if (texture.preloadColor) {
            glTexture.setPreloadColor(texture.preloadColor);
        }
        if (texture.image) { // Ignore transcoder for Images
            const image = texture.image;
            image.crossOrigin = "Anonymous";
            glTexture.setImage(image, {
                minFilter: texture.minFilter,
                magFilter: texture.magFilter,
                wrapS: texture.wrapS,
                wrapT: texture.wrapT,
                wrapR: texture.wrapR,
                flipY: texture.flipY,
                encoding: texture.encoding
            });
        } else if (texture.src) {
            const ext = texture.src.split('.').pop();
            switch (ext) { // Don't transcode recognized image file types
                case "jpeg":
                case "jpg":
                case "png":
                case "gif":
                    const image = new Image();
                    image.onload = () => {
                        glTexture.setImage(image, {
                            minFilter: texture.minFilter,
                            magFilter: texture.magFilter,
                            wrapS: texture.wrapS,
                            wrapT: texture.wrapT,
                            wrapR: texture.wrapR,
                            flipY: texture.flipY,
                            encoding: texture.encoding
                        });
                    };
                    image.src = texture.src; // URL or Base64 string
                    break;
                default: // Assume other file types need transcoding
                    if (!this.#textureTranscoder) {
                        this.error(`Can't create texture from 'src' - rendererModel needs to be configured with a TextureTranscoder for this file type ('${ext}')`);
                    } else {
                        loadArraybuffer(texture.src, (arrayBuffer: ArrayBuffer) => {
                                if (!arrayBuffer.byteLength) {
                                    this.error(`Can't create texture from 'src': file data is zero length`);
                                    return;
                                }
                                this.#textureTranscoder.transcode([arrayBuffer]).then((compressedTextureData) => {
                                    glTexture.setCompressedData(compressedTextureData);
                                    this.#webglRenderer.setImageDirty();
                                });
                            },
                            (errMsg: string) => {
                                this.error(`Can't create texture from 'src': ${errMsg}`);
                            });
                    }
                    break;
            }
        } else if (texture.buffers) { // Buffers implicitly require transcoding
            if (!this.#textureTranscoder) {
                this.error(`Can't create texture from 'buffers' - rendererModel needs to be configured with a TextureTranscoder for this option`);
            } else {
                this.#textureTranscoder.transcode(texture.buffers).then((compressedTextureData) => {
                    glTexture.setCompressedData(compressedTextureData);
                    this.#webglRenderer.setImageDirty();
                });
            }
        }
        const rendererTexture = new WebGLRendererTexture(texture, glTexture);
        texture.rendererTexture = rendererTexture;
        this.rendererTextures[textureId] = rendererTexture;
    }

    #attachGeometry(geometry: SceneGeometry): void {
        // Attaches a WebGLRendererGeometry to the given SceneGeometry
        const geometryId = geometry.id;
        if (this.rendererGeometries[geometryId]) {
            throw new SDKError(`RendererGeometry with ID ${geometryId} already created in WebGLRendererModel`);
        }
        const rendererGeometry = new WebGLRendererGeometry();
        this.rendererGeometries[geometryId] = rendererGeometry;
        geometry.rendererGeometry = rendererGeometry;
        this.#numGeometries++;
    }

    #attachMesh(mesh: SceneMesh): void {
        // Attaches a WebGLRendererMesh to the given SceneMesh
        const rendererGeometry = this.rendererGeometries[mesh.geometry.id];
        if (!rendererGeometry) {
            throw new SDKError(`RendererGeometry with ID ${mesh.geometry.id} not found in WebGLRendererModel`);
        }
        const textureSetId = mesh.textureSet ? (<SceneTextureSet>mesh.textureSet).id : defaultTextureSetId;
        const rendererTextureSet = this.rendererTextureSets[textureSetId];
        if (!rendererTextureSet) {
            throw new SDKError("SceneTextureSet not found");
        }
        const layer = this.#getLayer(textureSetId, mesh.geometry);
        if (!layer) {
            return; // TODO
        }
        let meshMatrix;
        let worldMatrix = this.#worldMatrixNonIdentity ? this.#worldMatrix : null;
        meshMatrix = mesh.matrix;
        const color = (mesh.color) ? new Uint8Array([Math.floor(mesh.color[0] * 255), Math.floor(mesh.color[1] * 255), Math.floor(mesh.color[2] * 255)]) : [255, 255, 255];
        const opacity = (mesh.opacity !== undefined && mesh.opacity !== null) ? Math.floor(mesh.opacity * 255) : 255;
        const metallic = (mesh.metallic !== undefined && mesh.metallic !== null) ? Math.floor(mesh.metallic * 255) : 0;
        const roughness = (mesh.roughness !== undefined && mesh.roughness !== null) ? Math.floor(mesh.roughness * 255) : 255;
        const rendererMesh = new WebGLRendererMesh({
            tileManager: <WebGLTileManager>this.#webglRenderer.tileManager,
            id: mesh.id,
            layer,
            color,
            opacity,
            matrix: meshMatrix,
            metallic,
            roughness,
            rendererTextureSet,
            rendererGeometry,
            meshIndex: 0
        });
        rendererMesh.pickId = this.#webglRenderer.attachPickable(rendererMesh);
        const a = rendererMesh.pickId >> 24 & 0xFF;
        const b = rendererMesh.pickId >> 16 & 0xFF;
        const g = rendererMesh.pickId >> 8 & 0xFF;
        const r = rendererMesh.pickId & 0xFF;
        const pickColor = new Uint8Array([r, g, b, a]);
        collapseAABB3(rendererMesh.aabb);
        const meshIndex = layer.createLayerMesh({pickColor}, mesh);
        expandAABB3(this.#aabb, rendererMesh.aabb);
        rendererMesh.layer = layer;
        rendererMesh.meshIndex = meshIndex;
        this.rendererMeshes[mesh.id] = rendererMesh;
        this.#numMeshes++;
    }

    #getLayer(textureSetId: string, geometryCompressedParams: SceneGeometryCompressedParams): Layer | undefined {
        const layerId = `${textureSetId}_${geometryCompressedParams.primitive}`;
        let layer = this.#currentLayers[layerId];
        if (layer) {
            if (layer.canCreateLayerMesh(geometryCompressedParams)) {
                return layer;
            } else {
                layer.build();
                delete this.#currentLayers[layerId];
            }
        }
        let textureSet;
        if (textureSetId) {
            textureSet = this.rendererTextureSets[textureSetId];
            if (!textureSet) {
                this.error(`TextureSet with ID "${textureSetId}" not found in WebGLRendererModel - ensure that you create it first with createTextureSet()`);
                return;
            }
        }
        switch (geometryCompressedParams.primitive) {
            case TrianglesPrimitive:
            case SolidPrimitive:
            case SurfacePrimitive:
                layer = new TrianglesLayer(<LayerParams>{
                    gl: this.#renderContext.gl,
                    view: this.#view,
                    rendererModel: this,
                    primitive: geometryCompressedParams.primitive,
                    textureSet,
                    layerIndex: 0
                });
                this.log(`Creating new TrianglesLayer`);
                break;
            default:
                this.error(`Primitive type not supported: ${geometryCompressedParams.primitive}`);
                return;
        }
        this.#layers[layerId] = layer;
        this.layerList.push(layer);
        this.#currentLayers[layerId] = layer;
        return layer;
    }

    #attachSceneObject(sceneObject: SceneObject): void {
        // Attaches a WebGLRendererObject to the given SceneObject
        let objectId = sceneObject.id;
        if (objectId === undefined) {
            objectId = createUUID();
        } else if (this.rendererObjects[objectId]) {
            this.error("Already has a WebGLRenderObject with this ID: " + objectId + " - will assign random ID");
            objectId = createUUID();
        }
        const meshes = sceneObject.meshes;
        if (meshes === undefined) {
            throw new SDKError("SceneObject property expected: meshes");
        }
        const rendererMeshes: WebGLRendererMesh[] = [];
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            const rendererMesh = <WebGLRendererMesh>this.rendererMeshes[mesh.id];
            rendererMeshes.push(rendererMesh);
        }
        const rendererObject = new WebGLRendererObject({
            id: objectId,
            sceneObject,
            rendererModel: this,
            rendererMeshes,
            aabb: sceneObject.aabb,
            layerId: this.#layerId
        });
        this.rendererObjectsList.push(rendererObject);
        this.rendererObjects[objectId] = rendererObject; // <RendererObject>
        sceneObject.rendererObject = rendererObject;
        this.#numRendererObjects++;
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

    #createDefaultTextureSet() {
        const defaultColorRendererTexture = new WebGLRendererTexture(
            null,
            new WebGLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [1, 1, 1, 1] // [r, g, b, a]})
            }));

        const defaultMetalRoughRendererTexture = new WebGLRendererTexture(
            null,
            new WebGLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [0, 1, 1, 1] // [unused, roughness, metalness, unused]
            }));
        const defaultNormalsRendererTexture = new WebGLRendererTexture(
            null,
            new WebGLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [0, 0, 0, 0] // [x, y, z, unused] - these must be zeros
            }));

        const defaultEmissiveRendererTexture = new WebGLRendererTexture(
            null,
            new WebGLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [0, 0, 0, 1] // [x, y, z, unused]
            }));
        const defaultOcclusionRendererTexture = new WebGLRendererTexture(
            null,
            new WebGLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [1, 1, 1, 1] // [x, y, z, unused]
            }));
        this.rendererTextures[defaultColorTextureId] = defaultColorRendererTexture;
        this.rendererTextures[defaultMetalRoughTextureId] = defaultMetalRoughRendererTexture;
        this.rendererTextures[defaultNormalsTextureId] = defaultNormalsRendererTexture;
        this.rendererTextures[defaultEmissiveTextureId] = defaultEmissiveRendererTexture;
        this.rendererTextures[defaultOcclusionTextureId] = defaultOcclusionRendererTexture;
        this.rendererTextureSets[defaultTextureSetId] = new WebGLRendererTextureSet({
            id: defaultTextureSetId,
            colorRendererTexture: defaultColorRendererTexture,
            metallicRoughnessRendererTexture: defaultMetalRoughRendererTexture,
            emissiveRendererTexture: defaultEmissiveRendererTexture,
            occlusionRendererTexture: defaultOcclusionRendererTexture
        });
    }

    #rebuildAABB() {
        collapseAABB3(this.#aabb);
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            const rendererObject = this.rendererObjectsList[i];
            expandAABB3(this.#aabb, rendererObject.aabb);
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

    #build() {
        for (let layerId in this.#currentLayers) {
            let layer = this.#currentLayers[layerId];
            layer.build();
            delete this.#currentLayers[layerId];
        }
    }

    // build() {
    //     if (this.destroyed) {
    //         this.log("rendererModel already destroyed");
    //         return;
    //     }
    //     if (this.built) {
    //         this.log("rendererModel already built");
    //         return;
    //     }
    //     for (let layerId in this.#currentLayers) {
    //         if (this.#currentLayers.hasOwnProperty(layerId)) {
    //             this.#currentLayers[layerId].build();
    //         }
    //     }
    //     for (let i = 0, len = this.objectList.length; i < len; i++) {
    //         const rendererObject = this.objectList[i];
    //         rendererObject.build();
    //     }
    //     for (let i = 0, len = this.objectList.length; i < len; i++) {
    //         const rendererObject = this.objectList[i];
    //         rendererObject.build2();
    //     }
    //     // this.layerList.sort((a, b) => {
    //     //     if (a.sortId < b.sortId) {
    //     //         return -1;
    //     //     }
    //     //     if (a.sortId > b.sortId) {
    //     //         return 1;
    //     //     }
    //     //     return 0;
    //     // });
    //     for (let i = 0, len = this.layerList.length; i < len; i++) {
    //         const layer = this.layerList[i];
    //         layer.layerIndex = i;
    //     }
    //     this.#currentLayers = {};
    //     this.built = true;
    //     this.#webglRenderer.setImageDirty();
    //     //     this.#view.viewer.scene.setAABBDirty();
    //     this.onBuilt.dispatch(this, null);
    // }
    //


    destroy() {
        if (this.destroyed) {
            return;
        }
        this.#detachSceneModel();
        this.#view.camera.onViewMatrix.unsubscribe(this.#onCameraViewMatrix);
        for (let layerId in this.#currentLayers) {
            if (this.#currentLayers.hasOwnProperty(layerId)) {
                this.#currentLayers[layerId].destroy();
            }
        }
        for (let i = 0, len = this.layerList.length; i < len; i++) {
            this.layerList[i].destroy();
        }
        for (let objectId in this.rendererObjects) {
            this.rendererObjects[objectId].destroy();
        }
        for (let meshId in this.rendererMeshes) {
            this.rendererMeshes[meshId].destroy();
            //    this.#webglRenderer.deregisterPickable(this.rendererMeshes[meshId].pickId);
        }
        this.#currentLayers = {};
        this.#layers = {};
        this.layerList = [];
        this.rendererGeometries = {};
        this.rendererTextures = {};
        this.rendererTextureSets = {};
        this.rendererMeshes = {};
        this.rendererObjects = {};
        // this.#view.viewer.setAABBDirty();
        super.destroy();
    }

    #detachSceneModel(): void {
        const sceneModel = this.sceneModel;
        if (!sceneModel) {
            return;
        }
        const textures = sceneModel.textures;
        const geometries = sceneModel.geometries;
        const meshes = sceneModel.meshes;
        const objects = sceneModel.objects;
        if (textures) {
            for (let textureId in textures) {
                const texture = textures[textureId];
                if (texture.rendererTexture) {
                    texture.rendererTexture = null;
                }
            }
        }
        if (geometries) {
            for (let geometryId in geometries) {
                const geometry = geometries[geometryId];
                if (geometry.rendererGeometry) {
                    geometry.rendererGeometry = null;
                }
            }
        }
        if (meshes) {
            for (let meshId in meshes) {
                const mesh = meshes[meshId];
                if (mesh.rendererMesh) {
                    mesh.rendererMesh = null;
                }
            }
        }
        if (objects) {
            for (let objectId in objects) {
                const object = objects[objectId];
                if (object.rendererObject) {
                    object.rendererObject = null;
                }
            }
        }
        this.sceneModel = null;
    }
}



