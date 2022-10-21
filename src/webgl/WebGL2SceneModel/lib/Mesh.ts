/**
 * @private
 */
import {Pickable} from "../../Pickable";
import {WebGLSceneObject} from "./WebGLSceneObject";
import {WebGL2Renderer} from "../../WebGL2Renderer";
import {FloatArrayType} from "../../../viewer/math/math";
import {AABB3} from "../../../viewer/math/boundaries";
import {DrawFlags} from "./DrawFlags";
import {FrameContext} from "../../lib/FrameContext";

class Mesh implements Pickable {

    id: string;
    pickId: number;
    sceneObject: WebGLSceneObject;
    aabb: FloatArrayType;
    numTriangles: number;
    webgl2Renderer: WebGL2Renderer;
    layer: any;
    portionId: any;
    color: FloatArrayType;
    colorize: FloatArrayType;
    colorizing: boolean;
    transparent: boolean;
    origin: FloatArrayType;

    constructor(params: {
        id: string,
        webgl2Renderer: WebGL2Renderer,
        color: FloatArrayType,
        opacity: number
    }) {
        this.webgl2Renderer = params.webgl2Renderer;
        this.sceneObject = null;
        this.id = params.id;
        this.pickId = this.webgl2Renderer.registerPickable(this);
        this.color = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        this.colorize = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        this.colorizing = false;
        this.transparent = (params.opacity < 255);
        this.numTriangles = 0;
        this.origin = null;
        this.sceneObject = null;
        this.layer = null;
        this.aabb = AABB3();
    }

    /**
     * Called by WebGL2SceneModel#createObject / WebGLSceneObject
     * @param sceneObject
     * @private
     */
    setSceneObject(sceneObject: WebGLSceneObject) {
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

    drawPickTriangles(drawFlags: any, frameContext: any) {
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

    drawPickDepths(drawFlags: DrawFlags, frameContext: FrameContext) {
        // this.sceneObject.sceneModel.drawPickDepths(frameContext);
    }

    drawPickNormals(frameContext: FrameContext) {
        //this.sceneObject.sceneModel.drawPickNormals(frameContext);
    }

    delegatePickedEntity(): WebGLSceneObject {
        return this.sceneObject;
    }

    destroy() {
        this.webgl2Renderer.deregisterPickable(this.pickId);
    }
}

export {Mesh};