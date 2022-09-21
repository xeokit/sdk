import * as math from "./../../../math/index";
import {WebGLVBOSceneObject} from "./WebGLVBOSceneObject";
import {WebGLSceneRendererPickable} from "./WebGLSceneRendererPickable";
import {WebGLSceneRenderer} from "../../WebGLSceneRenderer";
import {FloatArrayType} from "../../../math/index";
import {FrameContext} from "../../lib/FrameContext";
import {RenderFlags} from "./RenderFlags";
import {AABB3} from "../../../math/boundaries";

/**
 * @private
 */
class WebGLVBOMesh implements WebGLSceneRendererPickable {

    id: number | string;
    pickId: number;
    sceneObject: WebGLVBOSceneObject;
    aabb: math.FloatArrayType;
    numTriangles: number;
    webglSceneRenderer: WebGLSceneRenderer;
    layer: any;
    portionId: any;
    color: FloatArrayType;
    colorize: FloatArrayType;
    colorizing: boolean;
    transparent: boolean;
    origin: FloatArrayType;

    constructor(cfg: {
        id: string | number,
        webglSceneRenderer: WebGLSceneRenderer,
        color: FloatArrayType,
        opacity: number
    }) {
        this.webglSceneRenderer = cfg.webglSceneRenderer;
        this.sceneObject = null;
        this.id = cfg.id;
        this.pickId = this.webglSceneRenderer.getPickID(this);
        this.color = [cfg.color[0], cfg.color[1], cfg.color[2], cfg.opacity]; // [0..255]
        this.colorize = [cfg.color[0], cfg.color[1], cfg.color[2], cfg.opacity]; // [0..255]
        this.colorizing = false;
        this.transparent = (cfg.opacity < 255);
        this.numTriangles = 0;
        this.origin = null;
        this.sceneObject = null;
        this.layer = null;
        this.aabb = AABB3();
    }

    /**
     * Called by WebGLVBOSceneModel#createObject / WebGLVBOSceneObject
     * @param sceneObject
     * @private
     */
    setSceneObject(sceneObject: WebGLVBOSceneObject) {
        this.sceneObject = sceneObject;
    }
    
    finalize(entityFlags: any) {
        this.layer.initFlags(this.portionId, entityFlags, this.transparent);
    }

    finalize2() {
        if (this.layer.flushInitFlags) {
            this.layer.flushInitFlags();
        }
    }

    setVisible(entityFlags: any) {
        this.layer.setVisible(this.portionId, entityFlags, this.transparent);
    }

    setColor(color: FloatArrayType) {
        this.color[0] = color[0];
        this.color[1] = color[1];
        this.color[2] = color[2];
        if (!this.colorizing) {
            this.layer.setColor(this.portionId, this.color, false);
        }
    }

    setColorize(colorize: FloatArrayType) {
        const setOpacity = false;
        if (colorize) {
            this.colorize[0] = colorize[0];
            this.colorize[1] = colorize[1];
            this.colorize[2] = colorize[2];
            this.layer.setColor(this.portionId, this.colorize, setOpacity);
            this.colorizing = true;
        } else {
            this.layer.setColor(this.portionId, this.color, setOpacity);
            this.colorizing = false;
        }
    }

    setOpacity(opacity: number, entityFlags: number) {
        const newTransparent = (opacity < 255);
        const lastTransparent = this.transparent;
        const changingTransparency = (lastTransparent !== newTransparent);
        this.color[3] = opacity;
        this.colorize[3] = opacity;
        this.transparent = newTransparent;
        if (this.colorizing) {
            this.layer.setColor(this.portionId, this.colorize);
        } else {
            this.layer.setColor(this.portionId, this.color);
        }
        if (changingTransparency) {
            this.layer.setTransparent(this.portionId, entityFlags, newTransparent);
        }
    }

    setOffset(offset: FloatArrayType) {
        this.layer.setOffset(this.portionId, offset);
    }

    setHighlighted(entityFlags: number) {
        this.layer.setHighlighted(this.portionId, entityFlags, this.transparent);
    }

    setXRayed(entityFlags: number) {
        this.layer.setXRayed(this.portionId, entityFlags, this.transparent);
    }

    setSelected(entityFlags: number) {
        this.layer.setSelected(this.portionId, entityFlags, this.transparent);
    }

    setEdges(entityFlags: number) {
        this.layer.setEdges(this.portionId, entityFlags, this.transparent);
    }

    setClippable(entityFlags: number) {
        this.layer.setClippable(this.portionId, entityFlags, this.transparent);
    }

    setCollidable(entityFlags: number) {
        this.layer.setCollidable(this.portionId, entityFlags);
    }

    setPickable(flags: number) {
        this.layer.setPickable(this.portionId, flags, this.transparent);
    }

    setCulled(flags: number) {
        this.layer.setCulled(this.portionId, flags, this.transparent);
    }

    canPickTriangle() {
        return false;
    }

    drawPickTriangles(renderFlags: any, frameCtx: any) {
        // NOP
    }

    pickTriangleSurface(pickResult: any) {
        // NOP
    }

    precisionRayPickSurface(worldRayOrigin: any, worldRayDir: any, worldSurfacePos: any, worldSurfaceNormal: any) {
        return this.layer.precisionRayPickSurface ? this.layer.precisionRayPickSurface(this.portionId, worldRayOrigin, worldRayDir, worldSurfacePos, worldSurfaceNormal) : false;
    }

    canPickWorldPos() {
        return true;
    }

    drawPickDepths(renderFlags: RenderFlags, frameCtx: FrameContext) {
        // this.sceneObject.sceneModel.drawPickDepths(frameCtx);
    }

    drawPickNormals(frameCtx: FrameContext) {
        //this.sceneObject.sceneModel.drawPickNormals(frameCtx);
    }

    delegatePickedEntity(): WebGLVBOSceneObject {
        return this.sceneObject;
    }

    destroy() {
        this.webglSceneRenderer.putPickID(this.pickId);
    }
}

export {WebGLVBOMesh};