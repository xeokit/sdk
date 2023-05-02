import {EventDispatcher} from "strongly-typed-events";
import {Component, EventEmitter, TextureTranscoder} from "@xeokit/core";
import {createUUID, loadArraybuffer} from "@xeokit/utils";
import {collapseAABB3, expandAABB3} from "@xeokit/boundaries";
import {composeMat4, createMat4, createVec3, createVec4, eulerToQuat, identityQuat, mulMat4} from "@xeokit/matrix";

import type {FloatArrayParam} from "@xeokit/math";
import type {Camera, View} from "@xeokit/viewer";
import type {Viewer} from "@xeokit/viewer";
import {GLTexture} from "@xeokit/webglutils";
import type {
    Geometry,
    GeometryCompressedParams,
    Mesh,
    RendererGeometry,
    RendererMesh,
    RendererModel,
    RendererTexture,
    RendererTextureSet,
    SceneModel,
    SceneObject,
    Texture,
    TextureSet
} from "@xeokit/scene";
import type {WebGLRenderer} from "./WebGLRenderer";
import {Layer} from "./Layer";
import type {RenderContext} from "./RenderContext";
import {RendererGeometryImpl} from "./RendererGeometryImpl";

import {RendererTextureImpl} from "./RendererTextureImpl";
import {RendererObjectImpl} from "./RendererObjectImpl";
import {RendererMeshImpl} from "./RendererMeshImpl";
import {RendererTextureSetImpl} from "./RendererTextureSetImpl";
import type {LayerParams} from "./LayerParams";
import type {TileManager} from "./TileManager";
import type {RendererViewObject} from "@xeokit/viewer";


const tempVec3a = createVec3();
const tempMat4 = createMat4();

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
export class RendererModelImpl extends Component implements RendererModel {

    readonly qualityRender: boolean;
    declare readonly id: string;
    declare readonly destroyed: boolean;
    declare built: boolean;

    sceneModel: SceneModel | null;

    rendererGeometries: { [key: string]: RendererGeometry };
    rendererTextures: { [key: string]: RendererTexture };
    rendererTextureSets: { [key: string]: RendererTextureSet; };
    rendererMeshes: { [key: string]: RendererMesh };
    rendererObjects: { [key: string]: RendererObjectImpl };
    rendererObjectsList: RendererObjectImpl[];

    rendererViewObjects: { [key: string]: RendererViewObject };

    readonly viewer: Viewer;

    layerList: Layer[];
    readonly onBuilt: EventEmitter<RendererModel, null>;
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
    #layerId: string | undefined;

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

        this.rendererViewObjects = {};

        this.#numGeometries = 0;
        this.#numViewerObjects = 0;

        this.#numTriangles = 0;
        this.#numLines = 0;
        this.#numPoints = 0;
        this.#edgeThreshold = params.edgeThreshold || 10;

        this.built = false;

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

        this.#createDefaultTextureSetRenderer();

        this.onBuilt = new EventEmitter(new EventDispatcher<RendererModel, null>());

        this.#addModel(params.sceneModel);

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
        //     this.#view.viewer.scene.setAABBDirty();
        this.onBuilt.dispatch(this, null);
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
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setVisible(viewIndex, visible);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setXRayed(viewIndex: number, xrayed: boolean): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setXRayed(viewIndex, xrayed);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setHighlighted(viewIndex, highlighted);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setSelected(viewIndex: number, selected: boolean): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setSelected(viewIndex, selected);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setEdges(viewIndex: number, edges: boolean): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setEdges(viewIndex, edges);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setCulled(viewIndex: number, culled: boolean): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setCulled(viewIndex, culled);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setClippable(viewIndex: number, clippable: boolean): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setClippable(viewIndex, clippable);
        }
        this.#webglRenderer.setImageDirty(viewIndex);
    }

    setCollidable(viewIndex: number, collidable: boolean): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setCollidable(viewIndex, collidable);
        }
    }

    setPickable(viewIndex: number, pickable: boolean): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setPickable(viewIndex, pickable);
        }
    }

    setColorize(viewIndex: number, colorize: FloatArrayParam): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setColorize(viewIndex, colorize);
        }
    }

    setOpacity(viewIndex: number, opacity: number): void {
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            this.rendererObjectsList[i].setOpacity(viewIndex, opacity);
        }
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
        this.#removeModel();
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
            //    this.#webglRenderer.deregisterPickable(this.rendererMeshes[meshId].pickId);
        }
        this.#currentLayers = {};
        this.#layers = {};
        this.layerList = [];
        this.rendererGeometries = {};
        this.rendererTextures = {};
        this.rendererTextureSets = {};
        this.rendererMeshes = {};
        this.rendererViewObjects = {};
        // this.#view.viewer.setAABBDirty();
        this.onBuilt.clear();
        super.destroy();
    }

    #addModel(sceneModel: SceneModel): void {

        const textures = sceneModel.textures;
        const geometries = sceneModel.geometries;
        const meshes = sceneModel.meshes;
        const objects = sceneModel.objects;

        if (textures) {
            for (let textureId in textures) {
                const texture = textures[textureId];
                this.#addTexture(texture);
            }
        }
        if (geometries) {
            for (let geometryId in geometries) {
                const geometry = geometries[geometryId];
                this.#addGeometry(geometry);
            }
        }
        if (meshes) {
            for (let meshId in meshes) {
                const mesh = meshes[meshId];
                this.#addMesh(mesh);
            }
        }
        if (objects) {
            for (let geometryId in objects) {
                const object = objects[geometryId];
                this.#addObject(object);
            }
        }
        for (let layerId in this.#currentLayers) {
            if (this.#currentLayers.hasOwnProperty(layerId)) {
                this.#currentLayers[layerId].build();
            }
        }
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            const objectRenderer = this.rendererObjectsList[i];
            objectRenderer.build();
        }
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            const objectRenderer = this.rendererObjectsList[i];
            objectRenderer.finalize2();
        }
    }

    #addTexture(texture: Texture): void {
        const textureId = texture.id;
        if (this.rendererTextures[textureId]) {
            throw new Error("RendererTexture already created: " + textureId);
        }
        const glTexture = new GLTexture({gl: this.#renderContext.gl});
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
        const rendererTexture = new RendererTextureImpl(texture, glTexture);
        texture.rendererTexture = rendererTexture;
        this.rendererTextures[textureId] = rendererTexture;
    }

    #addGeometry(geometry: Geometry): void {
        const geometryId = geometry.id;
        if (this.rendererGeometries[geometryId]) {
            throw new Error(`GeometryRenderer already created: ${geometryId}`);
        }
        const rendererGeometry = new RendererGeometryImpl();
        this.rendererGeometries[geometryId] = rendererGeometry;
        geometry.rendererGeometry = rendererGeometry;
        this.#numGeometries++;
    }

    #addMesh(mesh: Mesh): void {
        const rendererGeometry = this.rendererGeometries[mesh.geometry.id];
        if (!rendererGeometry) {
            throw new Error("RendererGeometry not found");
        }
        const rendererTextureSet = this.rendererTextureSets[(<TextureSet>mesh.textureSet).id];
        if (!rendererTextureSet) {
            throw new Error("rendererTextureSet not found");
        }

        const layer = this.#getLayer((<TextureSet>mesh.textureSet).id, mesh.geometry);

        if (!layer) {
            return;
        }

        if (!layer.hasGeometry(mesh.geometry.id)) {
            layer.createGeometryCompressed(mesh.geometry)
        }

        let meshMatrix;
        let worldMatrix = this.#worldMatrixNonIdentity ? this.#worldMatrix : null;

        meshMatrix = mesh.matrix;


        const color = (mesh.color) ? new Uint8Array([Math.floor(mesh.color[0] * 255), Math.floor(mesh.color[1] * 255), Math.floor(mesh.color[2] * 255)]) : [255, 255, 255];
        const opacity = (mesh.opacity !== undefined && mesh.opacity !== null) ? Math.floor(mesh.opacity * 255) : 255;
        const metallic = (mesh.metallic !== undefined && mesh.metallic !== null) ? Math.floor(mesh.metallic * 255) : 0;
        const roughness = (mesh.roughness !== undefined && mesh.roughness !== null) ? Math.floor(mesh.roughness * 255) : 255;

        const meshRenderer = new RendererMeshImpl({
            tileManager: <TileManager>this.#webglRenderer.tileManager,
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

        meshRenderer.pickId = this.#webglRenderer.registerPickable(meshRenderer);

        const a = meshRenderer.pickId >> 24 & 0xFF;
        const b = meshRenderer.pickId >> 16 & 0xFF;
        const g = meshRenderer.pickId >> 8 & 0xFF;
        const r = meshRenderer.pickId & 0xFF;

        const pickColor = new Uint8Array([r, g, b, a]); // Quantized pick color
        collapseAABB3(meshRenderer.aabb);

        const meshIndex = layer.createMesh({
            id: mesh.id,
            geometryId: mesh.geometry.id,
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
        expandAABB3(this.#aabb, meshRenderer.aabb);
        meshRenderer.layer = layer;
        meshRenderer.meshIndex = meshIndex;
        this.rendererMeshes[mesh.id] = meshRenderer;
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
    //         const objectRenderer = this.objectList[i];
    //         objectRenderer.build();
    //     }
    //     for (let i = 0, len = this.objectList.length; i < len; i++) {
    //         const objectRenderer = this.objectList[i];
    //         objectRenderer.finalize2();
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
    // addModel(params: {
    //     id: string,
    //     sceneModel: SceneModel
    // }) {
    //
    //     const sceneModel = params.sceneModel;
    //     const textures = sceneModel.textures;
    //     const geometries = sceneModel.geometries;
    //     const meshes = sceneModel.meshes;
    //     const objects = sceneModel.objects;
    //
    //     if (textures) {
    //         for (let textureId in textures) {
    //             const texture = textures[textureId];
    //             this.#addTexture(texture);
    //         }
    //     }
    //
    //     if (geometries) {
    //         for (let geometryId in geometries) {
    //             const geometry = geometries[geometryId];
    //             this.#addGeometry(geometry);
    //         }
    //     }
    //
    //     if (meshes) {
    //         for (let meshId in meshes) {
    //             const mesh = meshes[meshId];
    //             this.#addMesh(mesh);
    //         }
    //     }
    //
    //     if (objects) {
    //         for (let geometryId in objects) {
    //             const object = objects[geometryId];
    //             this.#addObject(object);
    //         }
    //     }
    // }

    #addObject(sceneObject: SceneObject): void {
        let objectId = sceneObject.id;
        if (objectId === undefined) {
            objectId = createUUID();
        } else if (this.rendererObjects[objectId]) {
            this.error("[createObject] rendererModel already has a ViewerObject with this ID: " + objectId + " - will assign random ID");
            objectId = createUUID();
        }
        const meshes = sceneObject.meshes;
        if (meshes === undefined) {
            throw new Error("[createObject] Param expected: meshes");
        }
        const rendererMeshes: RendererMeshImpl[] = [];
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            const rendererMesh = <RendererMeshImpl>this.rendererMeshes[mesh.id];
            rendererMeshes.push(rendererMesh);
        }
        const objectRenderer = new RendererObjectImpl({
            id: objectId,
            rendererModel: this,
            rendererMeshes,
            aabb: sceneObject.aabb,
            layerId: this.#layerId
        });
        this.rendererObjectsList.push(objectRenderer);
        this.rendererObjects[objectId] = objectRenderer;
        this.rendererViewObjects[objectId] = objectRenderer;
        this.#numViewerObjects++;
    }

    #removeModel(): void {
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

    #createDefaultTextureSetRenderer() {
        const defaultColorTexture = new RendererTextureImpl(
            null,
            new GLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [1, 1, 1, 1] // [r, g, b, a]})
            }));

        const defaultMetalRoughTexture = new RendererTextureImpl(
            null,
            new GLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [0, 1, 1, 1] // [unused, roughness, metalness, unused]
            }));
        const defaultNormalsTexture = new RendererTextureImpl(
            null,
            new GLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [0, 0, 0, 0] // [x, y, z, unused] - these must be zeros
            }));

        const defaultEmissiveTexture = new RendererTextureImpl(
            null,
            new GLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [0, 0, 0, 1] // [x, y, z, unused]
            }));
        const defaultOcclusionTexture = new RendererTextureImpl(
            null,
            new GLTexture({
                gl: this.#renderContext.gl,
                preloadColor: [1, 1, 1, 1] // [x, y, z, unused]
            }));
        this.rendererTextures[defaultColorTextureId] = defaultColorTexture;
        this.rendererTextures[defaultMetalRoughTextureId] = defaultMetalRoughTexture;
        this.rendererTextures[defaultNormalsTextureId] = defaultNormalsTexture;
        this.rendererTextures[defaultEmissiveTextureId] = defaultEmissiveTexture;
        this.rendererTextures[defaultOcclusionTextureId] = defaultOcclusionTexture;
        this.rendererTextureSets[defaultTextureSetId] = new RendererTextureSetImpl({
            id: defaultTextureSetId,
            colorTexture: defaultColorTexture,
            metallicRoughnessTexture: defaultMetalRoughTexture,
            emissiveTexture: defaultEmissiveTexture,
            occlusionTexture: defaultOcclusionTexture
        });
    }

    #getLayer(textureSetId: string | undefined, geometryCompressedParams: GeometryCompressedParams): Layer | undefined {
        const layerId = `${textureSetId}_${geometryCompressedParams.primitive}`;
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
            textureSet = this.rendererTextureSets[textureSetId];
            if (!textureSet) {
                this.error(`TextureSet not found: ${textureSetId} - ensure that you create it first with createTextureSet()`);
                return;
            }
        }
        layer = new Layer(<LayerParams>{
            gl: this.#renderContext.gl,
            view: this.#view,
            rendererModel: this,
            primitive: geometryCompressedParams.primitive,
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
        for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
            const objectRenderer = this.rendererObjectsList[i];
            expandAABB3(this.#aabb, objectRenderer.aabb);
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



