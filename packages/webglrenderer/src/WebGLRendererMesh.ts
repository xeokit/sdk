import type {RendererGeometry, RendererMesh, RendererObject, RendererTextureSet, SceneObject} from "@xeokit/scene";
import type {FloatArrayParam} from "@xeokit/math";
import {createAABB3} from "@xeokit/boundaries";

import type {RenderContext} from "./RenderContext";
import type {Pickable} from "./Pickable";
import {createMat4, mulMat4, transformPoint3, translationMat4c} from "@xeokit/matrix";
import type {Tile, WebGLTileManager} from "./WebGLTileManager";
import {Layer} from "./Layer";

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
    opacity: number;
    pickId: number;
    tileManager: WebGLTileManager;
    tile: Tile;
    rendererObject: RendererObject | null;
    aabb: FloatArrayParam;
    layer: Layer;
    meshIndex: number;
    colorize: FloatArrayParam[];
    colorizing: boolean[];
    transparent: boolean[];
    attribs: any;

    constructor(params: {
        tileManager: WebGLTileManager,
        layer: Layer,
        id: string,
        matrix: FloatArrayParam;
        color: FloatArrayParam,
        opacity: number,
        rendererTextureSet: RendererTextureSet
        rendererGeometry: RendererGeometry,
        meshIndex: number
    }) {
        this.rendererObject = null;
        this.tileManager = params.tileManager;
        this.id = params.id;
        this.pickId = 0;
        this.attribs = [];
        this.color = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        for (let i = 0; i < 4; i++) {
            this.attribs.push({
                colorize: [params.color[0], params.color[1], params.color[2], params.opacity], // [0..255]
                colorizing: false,
                transparent: (params.opacity < 255),
            });
        }
        this.layer = params.layer;
        this.matrix = params.matrix;
        this.opacity = params.opacity;
        this.aabb = createAABB3();
        this.rendererTextureSet = params.rendererTextureSet;
        this.rendererGeometry = params.rendererGeometry;
        this.meshIndex = params.meshIndex;
    }

    delegatePickedEntity(): SceneObject {
        throw new Error("Method not implemented.");
    }

    setRendererObject(rendererObject: RendererObject) {
        this.rendererObject = rendererObject;
    }

    setVisible(viewIndex: number, flags: any) {
        this.layer.setLayerMeshVisible(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }

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
            //   this.layer.setLayerMeshViewMatrixIndex(this.meshIndex, this.tile.index);
        }
    }

    setColor(color: FloatArrayParam) {
        const setOpacity = false;
        this.color[0] = color[0];
        this.color[1] = color[1];
        this.color[2] = color[2];
        if (!this.colorizing) {
            for (let viewIndex = 0, len = this.layer.rendererModel.viewer.viewList.length; viewIndex < len; viewIndex++) {
                this.layer.setLayerMeshColor(viewIndex, this.meshIndex, color, setOpacity);
            }
        }
    }

    setColorize(viewIndex: number, colorize: FloatArrayParam | null) {
        const setOpacity = false;
        const attribs = this.attribs[viewIndex];
        const meshColorize = attribs.colorize;
        if (colorize) {
            meshColorize[0] = colorize[0];
            meshColorize[1] = colorize[1];
            meshColorize[2] = colorize[2];
            this.layer.setLayerMeshColor(viewIndex, this.meshIndex, meshColorize, setOpacity);
            attribs.colorizing = true;
        } else {
            this.layer.setLayerMeshColor(viewIndex, this.meshIndex, meshColorize, setOpacity);
            attribs.colorizing = false;
        }
    }

    setOpacity(viewIndex: number, opacity: number, flags: number) {
        const setOpacity = true;
        const attribs = this.attribs[viewIndex];
        const newTransparent = (opacity < 255);
        const lastTransparent = attribs.transparent;
        const changingTransparency = (lastTransparent !== newTransparent);
        attribs.color[3] = opacity;
        attribs.colorize[3] = opacity;
        attribs.transparent = newTransparent;
        if (this.colorizing) {
            this.layer.setLayerMeshColor(viewIndex, this.meshIndex, attribs.colorize, setOpacity);
        } else {
            this.layer.setLayerMeshColor(viewIndex, this.meshIndex, attribs.color, setOpacity);
        }
        if (changingTransparency) {
            this.layer.setLayerMeshTransparent(viewIndex, this.meshIndex, flags, newTransparent);
        }
    }

    setHighlighted(viewIndex: number, flags: number) {
        this.layer.setLayerMeshHighlighted(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }

    setXRayed(viewIndex: number, flags: number) {
        this.layer.setLayerMeshXRayed(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }

    setSelected(viewIndex: number, flags: number) {
        this.layer.setLayerMeshSelected(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }

    setClippable(viewIndex: number, flags: number) {
        this.layer.setLayerMeshClippable(viewIndex, this.meshIndex, flags);
    }

    setCollidable(viewIndex: number, flags: number) {
        this.layer.setLayerMeshCollidable(viewIndex, this.meshIndex, flags);
    }

    setPickable(viewIndex: number, flags: number) {
        this.layer.setLayerMeshPickable(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }

    setCulled(viewIndex: number, flags: number) {
        this.layer.setLayerMeshCulled(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
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
        //this.rendererObject.rendererModel.drawPickNormals(renderContext);
    }

    initFlags(viewIndex: number, flags: number) {
        this.layer.initFlags(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }

    commitRendererState(viewIndex: number) {
        this.layer.commitRendererState(viewIndex);
    }

    destroy() {
        if (this.tile && this.tileManager) {
            this.tileManager.putTile(this.tile);
        }
    }
}
