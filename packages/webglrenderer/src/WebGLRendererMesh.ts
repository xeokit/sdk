import type {RendererGeometry, RendererMesh, RendererObject, RendererTextureSet, SceneObject} from "@xeokit/scene";
import type {FloatArrayParam} from "@xeokit/math";
import {createAABB3} from "@xeokit/boundaries";

import type {RenderContext} from "./common/RenderContext";
import type {Pickable} from "./Pickable";
import {createMat4, mulMat4, transformPoint3, translationMat4c} from "@xeokit/matrix";
import type {Tile, WebGLTileManager} from "./WebGLTileManager";
import {RendererLayer} from "./common/RendererLayer";

const tempMat4a = createMat4();
const tempMat4b = createMat4();


/**
 * @private
 */
export class WebGLRendererMesh implements RendererMesh, Pickable {

    id: string;
    color: FloatArrayParam;
    rendererGeometry: RendererGeometry;
    rendererTextureSet: RendererTextureSet;
    matrix: FloatArrayParam;
    metallic: number;
    roughness: number;
    opacity: number;
    pickId: number;
    tileManager: WebGLTileManager;
    tile: Tile;
    sceneObjectRenderer: RendererObject | null;
    aabb: FloatArrayParam;
    layer: RendererLayer;
    meshIndex: number;
    colorize: FloatArrayParam;
    colorizing: boolean;
    transparent: boolean;

    constructor(params: {
        tileManager: WebGLTileManager,
        layer: RendererLayer,
        id: string,
        matrix: FloatArrayParam;
        metallic: number;
        roughness: number;
        color: FloatArrayParam,
        opacity: number,
        rendererTextureSet: RendererTextureSet
        rendererGeometry: RendererGeometry,
        meshIndex: number
    }) {
        this.sceneObjectRenderer = null;
        this.tileManager = params.tileManager;
        this.id = params.id;
        this.pickId = 0;
        this.color = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        this.colorize = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        this.colorizing = false;
        this.transparent = (params.opacity < 255);
        this.layer = params.layer;
        this.matrix = params.matrix;
        this.metallic = params.metallic;
        this.roughness = params.roughness;
        this.opacity = params.opacity;
        this.aabb = createAABB3();
        this.rendererTextureSet = params.rendererTextureSet;
        this.rendererGeometry = params.rendererGeometry;
        this.meshIndex = params.meshIndex;
    }

    delegatePickedEntity(): SceneObject {
        throw new Error("Method not implemented.");
    }

    setRendererObject(sceneObjectRenderer: RendererObject) {
        this.sceneObjectRenderer = sceneObjectRenderer;
    }

    build(flags: number) {
        // @ts-ignore
        this.layer.initFlags(this.meshIndex, flags, this.transparent);
    }

    build2() {
        this.layer.flushInitFlags();
    }

    setVisible(flags: any) {
        this.layer.setLayerMeshVisible(this.meshIndex, flags, this.transparent);
    }

    /**
     * Loads a modeling matrix into the {@link WebGLRenderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneMesh | SceneMesh.matrix}.
     *
     * @internal
     */
    setMatrix(matrix: FloatArrayParam): void {
        const center = transformPoint3(matrix, [0, 0, 0]);
        const oldTile = this.tile;
        this.tile = oldTile ? this.tileManager.updateTileCenter(oldTile, center) : this.tileManager.getTile(center);
        const tileChanged = !oldTile || oldTile.id !== this.tile.id;
        const tileCenter = this.tile.center;
        const needRTC = (tileCenter[0] !== 0 || tileCenter[1] !== 0 || tileCenter[2] !== 0);
        this.layer.setLayerMeshMatrix(this.meshIndex, needRTC
            ? mulMat4(matrix, translationMat4c(-tileCenter[0], -tileCenter[1], -tileCenter[2], tempMat4a), tempMat4b)
            : matrix);
        if (tileChanged) {
            this.layer.setLayerMeshViewMatrixIndex(this.meshIndex, this.tile.index);
        }
    }

    /**
     * Loads a metalness value into the {@link WebGLRenderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneMesh | SceneMesh.metalness}.
     *
     * @internal
     */
    setMetallic(metallic: number): void {
    }

    /**
     * Loads a roughness value into the {@link WebGLRenderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneMesh | SceneMesh.roughness}.
     *
     * @internal
     */
    setRoughness(roughness: number): void {
    }

    /**
     * Loads a color value into the {@link WebGLRenderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneMesh | SceneMesh.color}.
     *
     * @internal
     */
    setColor(color: FloatArrayParam) {
        this.color[0] = color[0];
        this.color[1] = color[1];
        this.color[2] = color[2];
        if (!this.colorizing) {
            this.layer.setLayerMeshColor(this.meshIndex, this.color);
        }
    }

    /**
     * Loads a roughness value into the {@link WebGLRenderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneObject | SceneObject.colorize}.
     *
     * @internal
     */
    setColorize(colorize: FloatArrayParam | null) {
        const setOpacity = false;
        if (colorize) {
            this.colorize[0] = colorize[0];
            this.colorize[1] = colorize[1];
            this.colorize[2] = colorize[2];
            this.layer.setLayerMeshColor(this.meshIndex, this.colorize, setOpacity);
            this.colorizing = true;
        } else {
            this.layer.setLayerMeshColor(this.meshIndex, this.color, setOpacity);
            this.colorizing = false;
        }
    }

    setOpacity(opacity: number, flags: number) {
        const newTransparent = (opacity < 255);
        const lastTransparent = this.transparent;
        const changingTransparency = (lastTransparent !== newTransparent);
        this.color[3] = opacity;
        this.colorize[3] = opacity;
        this.transparent = newTransparent;
        if (this.colorizing) {
            this.layer.setLayerMeshColor(this.meshIndex, this.colorize);
        } else {
            this.layer.setLayerMeshColor(this.meshIndex, this.color);
        }
        if (changingTransparency) {
            this.layer.setLayerMeshTransparent(this.meshIndex, flags, newTransparent);
        }
    }

    setHighlighted(flags: number) {
        this.layer.setLayerMeshHighlighted(this.meshIndex, flags, this.transparent);
    }

    setXRayed(flags: number) {
        this.layer.setLayerMeshXRayed(this.meshIndex, flags, this.transparent);
    }

    setSelected(flags: number) {
        this.layer.setLayerMeshSelected(this.meshIndex, flags, this.transparent);
    }

    setEdges(flags: number) {
        this.layer.setLayerMeshEdges(this.meshIndex, flags, this.transparent);
    }

    setClippable(flags: number) {
        this.layer.setLayerMeshClippable(this.meshIndex, flags);
    }

    setCollidable(flags: number) {
        this.layer.setLayerMeshCollidable(this.meshIndex, flags);
    }

    setPickable(flags: number) {
        this.layer.setLayerMeshPickable(this.meshIndex, flags, this.transparent);
    }

    setCulled(flags: number) {
        this.layer.setLayerMeshCulled(this.meshIndex, flags, this.transparent);
    }

    canPickTriangle() {
        return false;
    }

    drawPickTriangles(drawFlags: any, renderContext: any) {
        // NOP
    }

    pickTriangleSurface(pickResult: any) {
        // NOP
    }

    canPickWorldPos() {
        return true;
    }

    drawPickNormals(renderContext: RenderContext) {
        //this.sceneObjectRenderer.rendererModel.drawPickNormals(renderContext);
    }

    // delegatePickedEntity(): SceneObjectRendererCommands {
    //     return <SceneObjectRendererCommands>this.sceneObjectRenderer;
    // }

    destroy() {
        if (this.tile && this.tileManager) {
            this.tileManager.putTile(this.tile);
        }
    }
}
