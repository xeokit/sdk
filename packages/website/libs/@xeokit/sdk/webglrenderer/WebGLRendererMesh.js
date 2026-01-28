import { createAABBFloat64 } from "../boundaries";
import { createMat4, mulMat4, transformPoint3, translationMat4c } from "../matrix";
const tempMat4a = createMat4();
const tempMat4b = createMat4();
/**
 * @private
 */
export class WebGLRendererMesh {
    id;
    color;
    rendererGeometry;
    rendererTextureSet;
    matrix;
    opacity;
    pickId;
    tileManager;
    tile;
    rendererObject;
    aabb;
    layer;
    meshIndex;
    colorize;
    colorizing;
    transparent;
    attribs;
    constructor(params) {
        this.rendererObject = null;
        this.tileManager = params.tileManager;
        this.id = params.id;
        this.pickId = 0;
        this.attribs = [];
        this.color = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        for (let i = 0; i < 4; i++) {
            this.attribs.push({
                colorize: [params.color[0], params.color[1], params.color[2], params.opacity],
                colorizing: false,
                transparent: (params.opacity < 255),
            });
        }
        this.layer = params.layer;
        this.matrix = params.matrix;
        this.opacity = params.opacity;
        this.aabb = createAABBFloat64();
        this.rendererTextureSet = params.rendererTextureSet;
        this.rendererGeometry = params.sceneGeometryRendererProxy;
        this.meshIndex = params.meshIndex;
    }
    delegatePickedEntity() {
        throw new Error("Method not implemented.");
    }
    setRendererObject(rendererObject) {
        this.rendererObject = rendererObject;
    }
    setVisible(viewIndex, flags) {
        this.layer.setLayerMeshVisible(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }
    setMatrix(matrix) {
        const center = transformPoint3(matrix, [0, 0, 0]);
        const oldTile = this.tile;
        this.tile = oldTile ? this.tileManager.moveTile(oldTile, center) : this.tileManager.getTile(center);
        const tileChanged = !oldTile || oldTile.id !== this.tile.id;
        const tileCenter = this.tile.center;
        const needRTC = (tileCenter[0] !== 0 || tileCenter[1] !== 0 || tileCenter[2] !== 0);
        this.layer.setLayerMeshMatrix(this.meshIndex, needRTC
            ? mulMat4(matrix, translationMat4c(-tileCenter[0], -tileCenter[1], -tileCenter[2], tempMat4a), tempMat4b)
            : matrix);
        if (tileChanged) {
            //   this._layer.setLayerMeshViewMatrixIndex(this._meshIndex, this.tile.index);
        }
    }
    setColor(color) {
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
    setColorize(viewIndex, colorize) {
        const setOpacity = false;
        const attribs = this.attribs[viewIndex];
        const meshColorize = attribs.colorize;
        if (colorize) {
            meshColorize[0] = colorize[0];
            meshColorize[1] = colorize[1];
            meshColorize[2] = colorize[2];
            this.layer.setLayerMeshColor(viewIndex, this.meshIndex, meshColorize, setOpacity);
            attribs.colorizing = true;
        }
        else {
            this.layer.setLayerMeshColor(viewIndex, this.meshIndex, meshColorize, setOpacity);
            attribs.colorizing = false;
        }
    }
    setOpacity(viewIndex, opacity, flags) {
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
        }
        else {
            this.layer.setLayerMeshColor(viewIndex, this.meshIndex, attribs.color, setOpacity);
        }
        if (changingTransparency) {
            this.layer.setLayerMeshTransparent(viewIndex, this.meshIndex, flags, newTransparent);
        }
    }
    setHighlighted(viewIndex, flags) {
        this.layer.setLayerMeshHighlighted(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }
    setXRayed(viewIndex, flags) {
        this.layer.setLayerMeshXRayed(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }
    setSelected(viewIndex, flags) {
        this.layer.setLayerMeshSelected(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }
    setClippable(viewIndex, flags) {
        this.layer.setLayerMeshClippable(viewIndex, this.meshIndex, flags);
    }
    setCollidable(viewIndex, flags) {
        this.layer.setLayerMeshCollidable(viewIndex, this.meshIndex, flags);
    }
    setPickable(viewIndex, flags) {
        this.layer.setLayerMeshPickable(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }
    setCulled(viewIndex, flags) {
        this.layer.setLayerMeshCulled(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }
    canPickTriangle() {
        return false;
    }
    drawPickTriangles(drawFlags, renderContext) {
        // NOP
    }
    pickTriangleSurface(pickResult) {
        // NOP
    }
    canPickWorldPos() {
        return true;
    }
    drawPickNormals(renderContext) {
        //this.sceneObjectRendererProxy.rendererModel.drawPickNormals(#renderContext);
    }
    initFlags(viewIndex, flags) {
        this.layer.initFlags(viewIndex, this.meshIndex, flags, this.attribs[viewIndex].transparent);
    }
    commitRendererState(viewIndex) {
        this.layer.commitRendererState(viewIndex);
    }
    destroy() {
        if (this.tile && this.tileManager) {
            this.tileManager.putTile(this.tile);
        }
    }
}
//# sourceMappingURL=RendererMesh.js.map
