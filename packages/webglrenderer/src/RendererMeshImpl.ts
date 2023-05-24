import type {RendererGeometry, RendererMesh, RendererObject, RendererTextureSet, SceneObject} from "@xeokit/scene";
import type {FloatArrayParam} from "@xeokit/math";
import {createAABB3} from "@xeokit/boundaries";

import type {RenderContext} from "./RenderContext";
import type {Layer} from "./Layer";
import type {Pickable} from "./Pickable";
import {createMat4, mulMat4, transformPoint3, translationMat4c} from "@xeokit/matrix";
import type {Tile, TileManager} from "./TileManager";

const tempMat4a = createMat4();
const tempMat4b = createMat4();


/**
 * @private
 */
export class RendererMeshImpl implements RendererMesh, Pickable {

    id: string;
    color: FloatArrayParam;
    rendererGeometry: RendererGeometry;
    rendererTextureSet: RendererTextureSet;
    matrix: FloatArrayParam;
    metallic: number;
    roughness: number;
    opacity: number;
    pickId: number;
    tileManager: TileManager;
    tile: Tile;
    sceneObjectRenderer: RendererObject | null;
    aabb: FloatArrayParam;
    layer: Layer;
    meshIndex: number;
    colorize: FloatArrayParam;
    colorizing: boolean;
    transparent: boolean;


    constructor(params: {
        tileManager: TileManager,
        layer: Layer,
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
        this.layer.setMeshVisible(this.meshIndex, flags, this.transparent);
    }

    setMatrix(matrix: FloatArrayParam): void {
        const center = transformPoint3(matrix, [0, 0, 0]);
        const oldTile = this.tile;
        this.tile = oldTile ? this.tileManager.updateTileCenter(oldTile, center) : this.tileManager.getTile(center);
        const tileChanged = !oldTile || oldTile.id !== this.tile.id;
        const tileCenter = this.tile.center;
        const needRTC = (tileCenter[0] !== 0 || tileCenter[1] !== 0 || tileCenter[2] !== 0);
        this.layer.setMeshMatrix(this.meshIndex, needRTC
            ? mulMat4(matrix, translationMat4c(-tileCenter[0], -tileCenter[1], -tileCenter[2], tempMat4a), tempMat4b)
            : matrix);
        if (tileChanged) {
            this.layer.setMeshViewMatrixIndex(this.meshIndex, this.tile.index);
        }
    }

    setMetallic(metallic: number): void {
    }

    setRoughness(roughness: number): void {
    }

    setColor(color: FloatArrayParam) {
        this.color[0] = color[0];
        this.color[1] = color[1];
        this.color[2] = color[2];
        if (!this.colorizing) {
            this.layer.setMeshColor(this.meshIndex, this.color);
        }
    }

    setColorize(colorize: FloatArrayParam | null) {
        const setOpacity = false;
        if (colorize) {
            this.colorize[0] = colorize[0];
            this.colorize[1] = colorize[1];
            this.colorize[2] = colorize[2];
            this.layer.setMeshColor(this.meshIndex, this.colorize, setOpacity);
            this.colorizing = true;
        } else {
            this.layer.setMeshColor(this.meshIndex, this.color, setOpacity);
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
            this.layer.setMeshColor(this.meshIndex, this.colorize);
        } else {
            this.layer.setMeshColor(this.meshIndex, this.color);
        }
        if (changingTransparency) {
            this.layer.setMeshTransparent(this.meshIndex, flags, newTransparent);
        }
    }

    setHighlighted(flags: number) {
        this.layer.setMeshHighlighted(this.meshIndex, flags, this.transparent);
    }

    setXRayed(flags: number) {
        this.layer.setMeshXRayed(this.meshIndex, flags, this.transparent);
    }

    setSelected(flags: number) {
        this.layer.setMeshSelected(this.meshIndex, flags, this.transparent);
    }

    setEdges(flags: number) {
        this.layer.setMeshEdges(this.meshIndex, flags, this.transparent);
    }

    setClippable(flags: number) {
        this.layer.setMeshClippable(this.meshIndex, flags);
    }

    setCollidable(flags: number) {
        this.layer.setMeshCollidable(this.meshIndex, flags);
    }

    setPickable(flags: number) {
        this.layer.setMeshPickable(this.meshIndex, flags, this.transparent);
    }

    setCulled(flags: number) {
        this.layer.setMeshCulled(this.meshIndex, flags, this.transparent);
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
