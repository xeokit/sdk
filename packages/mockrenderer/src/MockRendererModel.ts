import {EventDispatcher} from "strongly-typed-events";
import {Component, EventEmitter, SDKError} from "@xeokit/core";
import type {RendererViewObject, View, Viewer} from "@xeokit/viewer";
import type {
    RendererGeometry,
    RendererMesh,
    RendererSceneModel,
    RendererTexture,
    RendererTextureSet,
    SceneModel
} from "@xeokit/scene";
import {Geometry, Mesh, SceneObject, Texture, TextureSet} from "@xeokit/scene";
import type {MockRenderer} from "./MockRenderer";
import {MockRendererObject} from "./MockRendererObject";
import {MockRendererTexture} from "./MockRendererTexture";
import {MockRendererGeometry} from "./MockRendererGeometry";
import {MockRendererMesh} from "./MockRendererMesh";

import {createUUID} from "@xeokit/utils";
import {MockRendererTextureSet} from "./MockRendererTextureSet";

const defaultColorTextureId = "defaultColorTexture";
const defaultMetalRoughTextureId = "defaultMetalRoughTexture";
const defaultNormalsTextureId = "defaultNormalsTexture";
const defaultEmissiveTextureId = "defaultEmissiveTexture";
const defaultOcclusionTextureId = "defaultOcclusionTexture";
const defaultTextureSetId = "defaultTextureSet";

/**
 * Mock rendering strategy for a {@link @xeokit/scene!Mesh | Mesh}.
 *
 * See {@link @xeokit/mockrenderer} for usage.
 */
export class MockRendererModel extends Component implements RendererSceneModel {

    readonly qualityRender: boolean;
    declare readonly id: string;
    declare readonly destroyed: boolean;
    declare built: boolean;

    readonly viewer: Viewer;
    sceneModel: SceneModel | null;
    rendererGeometries: { [key: string]: RendererGeometry };
    rendererTextures: { [key: string]: RendererTexture };
    rendererTextureSets: { [key: string]: RendererTextureSet; };
    rendererMeshes: { [key: string]: RendererMesh };
    rendererSceneObjects: { [key: string]: MockRendererObject };
    rendererSceneObjectsList: MockRendererObject[];
    rendererViewObjects: { [key: string]: RendererViewObject };

    readonly onBuilt: EventEmitter<RendererSceneModel, null>;
    declare readonly onDestroyed: EventEmitter<Component, null>;

    /**
     * @private
     */
    constructor(params: {
        qualityRender: boolean;
        id: string;
        sceneModel: SceneModel;
        view: View;
        mockRenderer: MockRenderer;
    }) {

        super(params.view);

        this.id = params.id;
        this.sceneModel = params.sceneModel
        this.viewer = params.view.viewer;
        this.rendererGeometries = {};
        this.rendererTextures = {};
        this.rendererTextureSets = {};
        this.rendererMeshes = {};
        this.rendererSceneObjects = {};
        this.rendererSceneObjectsList = [];
        this.rendererViewObjects = {};
        this.built = false;
        this.qualityRender = (params.qualityRender !== false);
        this.onBuilt = new EventEmitter(new EventDispatcher<RendererSceneModel, null>());
        this.built = true;
        this.#createDefaultTextureSet();
        this.#attachSceneModel(this.sceneModel);
        this.onBuilt.dispatch(this, null);
    }

    #createDefaultTextureSet() {
        const defaultColorRendererTexture = new MockRendererTexture(null);
        const defaultMetalRoughRendererTexture = new MockRendererTexture(null);
        const defaultNormalsRendererTexture = new MockRendererTexture(null);
        const defaultEmissiveRendererTexture = new MockRendererTexture(null);
        const defaultOcclusionRendererTexture = new MockRendererTexture(null);
        this.rendererTextures[defaultColorTextureId] = defaultColorRendererTexture;
        this.rendererTextures[defaultMetalRoughTextureId] = defaultMetalRoughRendererTexture;
        this.rendererTextures[defaultNormalsTextureId] = defaultNormalsRendererTexture;
        this.rendererTextures[defaultEmissiveTextureId] = defaultEmissiveRendererTexture;
        this.rendererTextures[defaultOcclusionTextureId] = defaultOcclusionRendererTexture;
        this.rendererTextureSets[defaultTextureSetId] = new MockRendererTextureSet({
            id: defaultTextureSetId,
            colorRendererTexture: defaultColorRendererTexture,
            metallicRoughnessRendererTexture: defaultMetalRoughRendererTexture,
            emissiveRendererTexture: defaultEmissiveRendererTexture,
            occlusionRendererTexture: defaultOcclusionRendererTexture
        });
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
    }

    #attachTexture(texture: Texture): void {
        const textureId = texture.id;
        if (this.rendererTextures[textureId]) {
            throw new SDKError("RendererTexture already created: " + textureId);
        }
        const rendererTexture = new MockRendererTexture(texture);
        texture.rendererTexture = rendererTexture;
        this.rendererTextures[textureId] = rendererTexture;
    }

    #attachGeometry(geometry: Geometry): void {
        const geometryId = geometry.id;
        if (this.rendererGeometries[geometryId]) {
            throw new SDKError(`RendererGeometry already created: ${geometryId}`);
        }
        const rendererGeometry = new MockRendererGeometry();
        this.rendererGeometries[geometryId] = rendererGeometry;
        geometry.rendererGeometry = rendererGeometry;
    }

    #attachMesh(mesh: Mesh): void {
        const rendererGeometry = this.rendererGeometries[mesh.geometry.id];
        if (!rendererGeometry) {
            throw new SDKError("RendererGeometry not found");
        }
        const textureSetId = mesh.textureSet ? (<TextureSet>mesh.textureSet).id : defaultTextureSetId;
        const rendererTextureSet = this.rendererTextureSets[textureSetId];
        if (!rendererTextureSet) {
            throw new SDKError("TextureSet not found");
        }
        const meshRenderer = new MockRendererMesh({
            id: mesh.id,
            rendererTextureSet,
            rendererGeometry,
            meshIndex: 0
        });
        this.rendererMeshes[mesh.id] = meshRenderer;
    }

    #attachSceneObject(sceneObject: SceneObject): void {
        let objectId = sceneObject.id;
        if (objectId === undefined) {
            objectId = createUUID();
        } else if (this.rendererSceneObjects[objectId]) {
            this.error("[createObject] rendererSceneModel already has a ViewerObject with this ID: " + objectId + " - will assign random ID");
            objectId = createUUID();
        }
        const meshes = sceneObject.meshes;
        if (meshes === undefined) {
            throw new SDKError("[createObject] Param expected: meshes");
        }
        const rendererMeshes: MockRendererMesh[] = [];
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            const rendererMesh = <MockRendererMesh>this.rendererMeshes[mesh.id];
            rendererMeshes.push(rendererMesh);
        }
        const rendererSceneObject = new MockRendererObject({
            id: objectId,
            sceneObject,
            rendererSceneModel: this,
            rendererMeshes,
            aabb: sceneObject.aabb,
            layerId: "0"
        });
        this.rendererSceneObjectsList.push(rendererSceneObject);
        this.rendererSceneObjects[objectId] = rendererSceneObject; // <RendererSceneObject>
        this.rendererViewObjects[objectId] = rendererSceneObject; // <RendererViewObject>
    }

    destroy() {
        if (this.destroyed) {
            return;
        }
        this.rendererGeometries = {};
        this.rendererTextures = {};
        this.rendererTextureSets = {};
        this.rendererMeshes = {};
        this.rendererViewObjects = {};
        this.onBuilt.clear();
        super.destroy();
    }
}



