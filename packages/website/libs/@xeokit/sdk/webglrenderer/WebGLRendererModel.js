import { Component, SDKError } from "../core";
import { createUUID, loadArraybuffer } from "../utils";
import { collapseAABB3, expandAABB3 } from "../boundaries";
import { composeMat4, createMat4, createVec3, createVec4, eulerToQuat, identityQuat } from "../matrix";
import { WebGLTexture } from "../webglutils";
import { WebGLRendererGeometry } from "./WebGLRendererGeometry";
import { WebGLRendererTexture } from "./WebGLRendererTexture";
import { WebGLRendererObject } from "./WebGLRendererObject";
import { WebGLRendererMesh } from "./WebGLRendererMesh";
import { WebGLRendererTextureSet } from "./WebGLRendererTextureSet";
import { MeshCounts } from "./MeshCounts";
import { LinesPrimitive, PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive } from "../constants";
import { RenderFlags } from "./RenderFlags";
import { VBOPointsBatchingLayer } from "./vbo/batching/points/VBOPointsBatchingLayer";
import { VBOTrianglesBatchingLayer } from "./vbo/batching/triangles/VBOTrianglesBatchingLayer";
import { VBOTrianglesInstancingLayer } from "./vbo/instancing/triangles/VBOTrianglesInstancingLayer";
import { VBOLinesInstancingLayer } from "./vbo/instancing/lines/VBOLinesInstancingLayer";
import { VBOLinesBatchingLayer } from "./vbo/batching/lines/VBOLinesBatchingLayer";
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
export class WebGLRendererModel extends Component {
    viewer;
    qualityRender;
    rendererGeometries;
    rendererTextures;
    rendererTextureSets;
    rendererMeshes;
    rendererObjects;
    rendererObjectsList;
    layerList;
    #layers;
    #currentLayers;
    meshCounts;
    webglRenderer;
    #renderContext;
    #position;
    #rotation;
    #quaternion;
    #scale;
    #worldMatrix;
    #viewMatrix;
    #colorTextureEnabled;
    #backfaces;
    #numGeometries;
    #numTextures;
    #numMeshes;
    #numTriangles;
    #numLines;
    #numPoints;
    #numRendererObjects;
    #textureTranscoder;
    #aabbDirty;
    #edgeThreshold;
    #aabb;
    #viewMatrixDirty;
    #worldMatrixNonIdentity;
    #onCameraViewMatrix;
    #layerId;
    numSubMeshes;
    renderFlags;
    constructor(params) {
        super(params.viewer);
        this.id = params.id;
        this.viewer = params.viewer;
        this.meshCounts = [
            new MeshCounts(),
            new MeshCounts(),
            new MeshCounts(),
            new MeshCounts()
        ];
        this.webglRenderer = params.webglRenderer;
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
        // this.#onCameraViewMatrix = this.#view.camera.onViewMatrix.subscribe((camera: Camera, viewMatrix: FloatArrayParam) => {
        //     this.#viewMatrixDirty = true;
        // });
        this.#createDefaultTextureSet();
        for (let i = 0, len = this.layerList.length; i < len; i++) {
            const layer = this.layerList[i];
            layer.layerIndex = i;
        }
        this.#currentLayers = {};
        //this.#build();
        this.#attachSceneModel(params.sceneModel);
        this.webglRenderer.setImageDirty();
        //     this.#view.viewer.scene.setAABBDirty();
        this.renderFlags = [
            new RenderFlags(),
            new RenderFlags(),
            new RenderFlags(),
            new RenderFlags()
        ];
    }
    #attachSceneModel(sceneModel) {
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
        const numViews = this.viewer.viewList.length;
        // for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
        //     for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
        //         this.rendererObjectsList[i].initFlags(viewIndex);
        //     }
        // }
        // for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
        //     for (let viewIndex = 0; viewIndex < numViews; viewIndex++) {
        //         this.rendererObjectsList[i].commitRendererState(viewIndex);
        //     }
        // }
    }
    #attachTexture(texture) {
        // Attaches a WebGLRendererTexture to the given SceneTexture
        const textureId = texture.id;
        if (this.rendererTextures[textureId]) {
            throw new SDKError(`WebGLRendererTexture with ID ${textureId} already created in WebGLRendererModel`);
        }
        const glTexture = new WebGLTexture({ gl: this.#renderContext.gl });
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
        }
        else if (texture.src) {
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
                    }
                    else {
                        loadArraybuffer(texture.src, (arrayBuffer) => {
                            if (!arrayBuffer.byteLength) {
                                this.error(`Can't create texture from 'src': file data is zero length`);
                                return;
                            }
                            this.#textureTranscoder.transcode([arrayBuffer]).then((compressedTextureData) => {
                                glTexture.setCompressedData(compressedTextureData);
                                this.webglRenderer.setImageDirty();
                            });
                        }, (errMsg) => {
                            this.error(`Can't create texture from 'src': ${errMsg}`);
                        });
                    }
                    break;
            }
        }
        else if (texture.buffers) { // Buffers implicitly require transcoding
            if (!this.#textureTranscoder) {
                this.error(`Can't create texture from 'buffers' - rendererModel needs to be configured with a TextureTranscoder for this option`);
            }
            else {
                this.#textureTranscoder.transcode(texture.buffers).then((compressedTextureData) => {
                    glTexture.setCompressedData(compressedTextureData);
                    this.webglRenderer.setImageDirty();
                });
            }
        }
        const rendererTexture = new WebGLRendererTexture(texture, glTexture);
        texture.rendererTexture = rendererTexture;
        this.rendererTextures[textureId] = rendererTexture;
    }
    #attachGeometry(geometry) {
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
    #attachMesh(mesh) {
        // Attaches a WebGLRendererMesh to the given SceneMesh
        const rendererGeometry = this.rendererGeometries[mesh.geometry.id];
        if (!rendererGeometry) {
            throw new SDKError(`RendererGeometry with ID ${mesh.geometry.id} not found in WebGLRendererModel`);
        }
        const textureSetId = mesh.textureSet ? mesh.textureSet.id : defaultTextureSetId;
        const rendererTextureSet = this.rendererTextureSets[textureSetId];
        if (!rendererTextureSet) {
            this.error(`TextureSet with ID "${textureSetId}" not found in WebGLRendererModel`);
        }
        const layer = this.#getLayer(textureSetId, mesh);
        if (!layer) {
            return; // TODO
        }
        let matrix = mesh.rtcMatrix;
        const color = (mesh.color) ? new Uint8Array([Math.floor(mesh.color[0] * 255), Math.floor(mesh.color[1] * 255), Math.floor(mesh.color[2] * 255)]) : [255, 255, 255];
        const opacity = (mesh.opacity !== undefined && mesh.opacity !== null) ? Math.floor(mesh.opacity * 255) : 255;
        const rendererMesh = new WebGLRendererMesh({
            tileManager: this.webglRenderer.tileManager,
            id: mesh.id,
            layer,
            color,
            opacity,
            matrix,
            rendererTextureSet,
            rendererGeometry,
            meshIndex: 0
        });
        rendererMesh.pickId = this.webglRenderer.attachPickable(rendererMesh);
        const a = rendererMesh.pickId >> 24 & 0xFF;
        const b = rendererMesh.pickId >> 16 & 0xFF;
        const g = rendererMesh.pickId >> 8 & 0xFF;
        const r = rendererMesh.pickId & 0xFF;
        const pickColor = new Uint8Array([r, g, b, a]);
        //    collapseAABB3(rendererMesh.aabb);
        const meshIndex = layer.createLayerMesh({ pickColor }, mesh);
        //  expandAABB3(this.#aabb, rendererMesh.aabb);
        rendererMesh.layer = layer;
        rendererMesh.meshIndex = meshIndex;
        this.rendererMeshes[mesh.id] = rendererMesh;
        this.#numMeshes++;
    }
    #getLayer(textureSetId, mesh) {
        const sceneGeometry = mesh.geometry;
        const primitive = sceneGeometry.primitive;
        const instancing = sceneGeometry.numMeshes > 1;
        const origin = mesh.tile.origin;
        const layerId = `VBO-${instancing ? "Instancing" : "Batching"}
        .${textureSetId}
        .${primitive}
        .${Math.round(origin[0])}.${Math.round(origin[1])}.${Math.round(origin[2])}
        .${instancing ? sceneGeometry.id : ""}`;
        let layer = this.#currentLayers[layerId];
        if (layer) {
            if (layer.canCreateLayerMesh(sceneGeometry)) {
                return layer;
            }
            else {
                layer.build();
                delete this.#currentLayers[layerId];
            }
        }
        let textureSet;
        if (textureSetId) {
            textureSet = this.rendererTextureSets[textureSetId];
            if (!textureSet) {
                this.error(`TextureSet with ID "${textureSetId}" not found in WebGLRendererModel - ensure that you create it first with createTextureSet()`);
                // Create layer without texture set
            }
        }
        if (instancing) {
            switch (sceneGeometry.primitive) {
                case TrianglesPrimitive:
                case SolidPrimitive:
                case SurfacePrimitive:
                    layer = new VBOTrianglesInstancingLayer({
                        renderContext: this.#renderContext,
                        rendererModel: this,
                        sceneGeometry,
                        textureSet,
                        layerIndex: 0,
                        origin
                    });
                    this.log(`Creating new VBOTrianglesInstancingLayer`);
                    break;
                case LinesPrimitive:
                    layer = new VBOLinesInstancingLayer({
                        renderContext: this.#renderContext,
                        rendererModel: this,
                        sceneGeometry,
                        textureSet,
                        layerIndex: 0,
                        origin
                    });
                    this.log(`Creating new VBOLinesInstancingLayer`);
                    break;
                case PointsPrimitive:
                    // layer = new VBOPointsInstancingLayer(<VBOInstancingLayerParams>{
                    //     renderContext: this.#renderContext,
                    //     rendererModel: this,
                    //     sceneGeometry,
                    //     textureSet,
                    //     layerIndex: 0,
                    //     origin
                    // });
                    this.log(`Creating new VBOPointsInstancingLayer`);
                    break;
                default:
                    this.error(`Primitive type not supported: ${sceneGeometry.primitive}`);
                    return;
            }
        }
        else {
            switch (sceneGeometry.primitive) {
                case TrianglesPrimitive:
                case SolidPrimitive:
                case SurfacePrimitive:
                    layer = new VBOTrianglesBatchingLayer({
                        renderContext: this.#renderContext,
                        rendererModel: this,
                        primitive,
                        textureSet,
                        layerIndex: 0,
                        origin
                    });
                    this.log(`Creating new VBOTrianglesBatchingLayer`);
                    break;
                case LinesPrimitive:
                    layer = new VBOLinesBatchingLayer({
                        primitive,
                        renderContext: this.#renderContext,
                        rendererModel: this,
                        textureSet,
                        layerIndex: 0,
                        origin
                    });
                    this.log(`Creating new VBOLinesBatchingLayer`);
                    break;
                case PointsPrimitive:
                    layer = new VBOPointsBatchingLayer({
                        renderContext: this.#renderContext,
                        rendererModel: this,
                        primitive,
                        textureSet,
                        layerIndex: 0,
                        origin
                    });
                    this.log(`Creating new VBOPointsBatchingLayer`);
                    break;
                default:
                    this.error(`Primitive type not supported: ${sceneGeometry.primitive}`);
                    return;
            }
        }
        this.#layers[layerId] = layer;
        this.layerList.push(layer);
        this.#currentLayers[layerId] = layer;
        return layer;
    }
    #attachSceneObject(sceneObject) {
        // Attaches a WebGLRendererObject to the given SceneObject
        let objectId = sceneObject.id;
        if (objectId === undefined) {
            objectId = createUUID();
        }
        else if (this.rendererObjects[objectId]) {
            this.error("Already has a WebGLRenderObject with this ID: " + objectId + " - will assign random ID");
            objectId = createUUID();
        }
        const meshes = sceneObject.meshes;
        if (meshes === undefined) {
            throw new SDKError("SceneObject property expected: meshes");
        }
        const rendererMeshes = [];
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            const rendererMesh = this.rendererMeshes[mesh.id];
            if (!rendererMesh) {
                console.error("WebGLRendererMesh not found: + " + mesh.id);
            }
            else {
                rendererMeshes.push(rendererMesh);
            }
        }
        if (rendererMeshes.length === 0) {
            return;
        }
        const rendererObject = new WebGLRendererObject({
            id: objectId,
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
    get position() {
        return this.#position;
    }
    get rotation() {
        return this.#rotation;
    }
    get quaternion() {
        return this.#quaternion;
    }
    get scale() {
        return this.#scale;
    }
    get worldMatrix() {
        return this.#worldMatrix;
    }
    get colorTextureEnabled() {
        return this.#colorTextureEnabled;
    }
    get backfaces() {
        return this.#backfaces;
    }
    set backfaces(backfaces) {
        backfaces = !!backfaces;
        this.#backfaces = backfaces;
        this.webglRenderer.setImageDirty();
    }
    get matrix() {
        return this.#worldMatrix;
    }
    get aabb() {
        if (this.#aabbDirty) {
            this.#rebuildAABB();
        }
        return this.#aabb;
    }
    get numTriangles() {
        return this.#numTriangles;
    }
    get numLines() {
        return this.#numLines;
    }
    get numPoints() {
        return this.#numPoints;
    }
    #createDefaultTextureSet() {
        const defaultColorRendererTexture = new WebGLRendererTexture(null, new WebGLTexture({
            gl: this.#renderContext.gl,
            preloadColor: [1, 1, 1, 1] // [r, g, b, a]})
        }));
        const defaultMetalRoughRendererTexture = new WebGLRendererTexture(null, new WebGLTexture({
            gl: this.#renderContext.gl,
            preloadColor: [0, 1, 1, 1] // [unused, roughness, metalness, unused]
        }));
        const defaultNormalsRendererTexture = new WebGLRendererTexture(null, new WebGLTexture({
            gl: this.#renderContext.gl,
            preloadColor: [0, 0, 0, 0] // [x, y, z, unused] - these must be zeros
        }));
        const defaultEmissiveRendererTexture = new WebGLRendererTexture(null, new WebGLTexture({
            gl: this.#renderContext.gl,
            preloadColor: [0, 0, 0, 1] // [x, y, z, unused]
        }));
        const defaultOcclusionRendererTexture = new WebGLRendererTexture(null, new WebGLTexture({
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
    /** @private */
    rebuildRenderFlags(viewIndex) {
        const renderFlags = this.renderFlags[viewIndex];
        renderFlags.reset();
        this.#updateRenderFlagsVisibleLayers(viewIndex);
        if (renderFlags.numLayers > 0 && renderFlags.numVisibleLayers === 0) {
            renderFlags.culled = true;
            return;
        }
        this.#updateRenderFlags(viewIndex);
    }
    /**
     * @private
     */
    #updateRenderFlagsVisibleLayers(viewIndex) {
        const renderFlags = this.renderFlags[viewIndex];
        renderFlags.numLayers = this.layerList.length;
        renderFlags.numVisibleLayers = 0;
        for (let layerIndex = 0, len = this.layerList.length; layerIndex < len; layerIndex++) {
            const layer = this.layerList[layerIndex];
            const layerVisible = this.#getActiveSectionPlanesForLayer(layer);
            if (layerVisible) {
                renderFlags.visibleLayers[renderFlags.numVisibleLayers++] = layerIndex;
            }
        }
    }
    #getActiveSectionPlanesForLayer(layer) {
        // const renderFlags = this.renderFlags;
        // const sectionPlanes = this.scene._sectionPlanesState.sectionPlanes;
        // const numSectionPlanes = sectionPlanes.length;
        // const baseIndex = layer.layerIndex * numSectionPlanes;
        // if (numSectionPlanes > 0) {
        //     for (let i = 0; i < numSectionPlanes; i++) {
        //         const sectionPlane = sectionPlanes[i];
        //         if (!sectionPlane.active) {
        //             renderFlags.sectionPlanesActivePerLayer[baseIndex + i] = false;
        //         } else {
        //             renderFlags.sectionPlanesActivePerLayer[baseIndex + i] = true;
        //             renderFlags.sectioned = true;
        //         }
        //     }
        // }
        return true;
    }
    #updateRenderFlags(viewIndex) {
        const meshCounts = this.meshCounts[viewIndex];
        if (meshCounts.numVisible === 0) {
            return;
        }
        if (meshCounts.numCulled === meshCounts.numMeshes) {
            return;
        }
        const renderFlags = this.renderFlags[viewIndex];
        renderFlags.colorOpaque = (meshCounts.numTransparent < meshCounts.numMeshes);
        if (meshCounts.numTransparent > 0) {
            renderFlags.colorTransparent = true;
        }
        if (meshCounts.numXRayed > 0) {
            const xrayMaterial = this.viewer[viewIndex].xrayMaterial;
            if (xrayMaterial.fill) {
                if (xrayMaterial.fillAlpha < 1.0) {
                    renderFlags.xrayedSilhouetteTransparent = true;
                }
                else {
                    renderFlags.xrayedSilhouetteOpaque = true;
                }
            }
            if (xrayMaterial.edges) {
                if (xrayMaterial.edgeAlpha < 1.0) {
                    renderFlags.xrayedEdgesTransparent = true;
                }
                else {
                    renderFlags.xrayedEdgesOpaque = true;
                }
            }
        }
        const edgeMaterial = this.viewer[viewIndex].edges;
        if (edgeMaterial.enabled) {
            renderFlags.edgesOpaque = (meshCounts.numTransparent < meshCounts.numMeshes);
            if (meshCounts.numTransparent > 0) {
                renderFlags.edgesTransparent = true;
            }
        }
        if (meshCounts.numSelected > 0) {
            const selectedMaterial = this.viewer[viewIndex].selectedMaterial;
            if (selectedMaterial.fill) {
                if (selectedMaterial.fillAlpha < 1.0) {
                    renderFlags.selectedSilhouetteTransparent = true;
                }
                else {
                    renderFlags.selectedSilhouetteOpaque = true;
                }
            }
            if (selectedMaterial.edges) {
                if (selectedMaterial.edgeAlpha < 1.0) {
                    renderFlags.selectedEdgesTransparent = true;
                }
                else {
                    renderFlags.selectedEdgesOpaque = true;
                }
            }
        }
        if (meshCounts.numHighlighted > 0) {
            const highlightMaterial = this.viewer[viewIndex].highlightMaterial;
            if (highlightMaterial.fill) {
                if (highlightMaterial.fillAlpha < 1.0) {
                    renderFlags.highlightedSilhouetteTransparent = true;
                }
                else {
                    renderFlags.highlightedSilhouetteOpaque = true;
                }
            }
            if (highlightMaterial.edges) {
                if (highlightMaterial.edgeAlpha < 1.0) {
                    renderFlags.highlightedEdgesTransparent = true;
                }
                else {
                    renderFlags.highlightedEdgesOpaque = true;
                }
            }
        }
    }
    #build() {
        // for (let layerId in this.#currentLayers) {
        //     let layer = this.#currentLayers[layerId];
        //     layer.build();
        //     delete this.#currentLayers[layerId];
        // }
        // for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
        //     const rendererObject = this.rendererObjectsList[i];
        //     rendererObject.initFlags();
        // }
        // for (let i = 0, len = this.rendererObjectsList.length; i < len; i++) {
        //     const rendererObject = this.rendererObjectsList[i];
        //     rendererObject.commitRendererState();
        // }
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
    //     this.webglRenderer.setImageDirty();
    //     //     this.#view.viewer.scene.setAABBDirty();
    //     this.onBuilt.dispatch(this, null);
    // }
    //
    destroy() {
        if (this.destroyed) {
            return;
        }
        //  this.detachSceneModel();
        //  this.#view.camera.onViewMatrix.unsubscribe(this.#onCameraViewMatrix);
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
            //    this.webglRenderer.deregisterPickable(this.rendererMeshes[meshId].pickId);
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
}
//# sourceMappingURL=WebGLRendererModel.js.map