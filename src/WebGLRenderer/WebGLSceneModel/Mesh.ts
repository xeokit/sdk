import {math} from "../../viewer/index";
import {Pickable} from "../Pickable";
import {WebGLSceneObject} from "./WebGLSceneObject";
import {RenderContext} from "../RenderContext";
import {Layer} from "./Layer";

class Mesh implements Pickable {

    id: string;
    pickId: number;
    sceneObject: WebGLSceneObject;
    aabb: math.FloatArrayType;
    layer: Layer;
    meshId: any;
    color: math.FloatArrayType;
    colorize: math.FloatArrayType;
    colorizing: boolean;
    transparent: boolean;
    origin: math.FloatArrayType;

    constructor(params: {
        id: string,
        color: math.FloatArrayType,
        opacity: number
    }) {
        this.sceneObject = null;
        this.id = params.id;
        this.pickId = 0;
        this.color = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        this.colorize = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        this.colorizing = false;
        this.transparent = (params.opacity < 255);
        this.origin = null;
        this.sceneObject = null;
        this.layer = null;
        this.aabb = math.boundaries.AABB3();
    }

    setSceneObject(sceneObject: WebGLSceneObject) {
        this.sceneObject = sceneObject;
    }

    finalize(flags: number) {
        this.layer.initFlags(this.meshId, flags, this.transparent);
    }

    finalize2() {
        if (this.layer.flushInitFlags) {
            this.layer.flushInitFlags();
        }
    }

    setVisible(flags: any) {
        this.layer.setMeshVisible(this.meshId, flags, this.transparent);
    }

    setColor(color: math.FloatArrayType) {
        this.color[0] = color[0];
        this.color[1] = color[1];
        this.color[2] = color[2];
        if (!this.colorizing) {
            this.layer.setMeshColor(this.meshId, this.color);
        }
    }

    setColorize(colorize: math.FloatArrayType) {
        const setOpacity = false;
        if (colorize) {
            this.colorize[0] = colorize[0];
            this.colorize[1] = colorize[1];
            this.colorize[2] = colorize[2];
            this.layer.setMeshColor(this.meshId, this.colorize, setOpacity);
            this.colorizing = true;
        } else {
            this.layer.setMeshColor(this.meshId, this.color, setOpacity);
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
            this.layer.setMeshColor(this.meshId, this.colorize);
        } else {
            this.layer.setMeshColor(this.meshId, this.color);
        }
        if (changingTransparency) {
            this.layer.setMeshTransparent(this.meshId, flags, newTransparent);
        }
    }

    setOffset(offset: math.FloatArrayType) {
        this.layer.setMeshOffset(this.meshId, offset);
    }

    setHighlighted(flags: number) {
        this.layer.setMeshHighlighted(this.meshId, flags, this.transparent);
    }

    setXRayed(flags: number) {
        this.layer.setMeshXRayed(this.meshId, flags, this.transparent);
    }

    setSelected(flags: number) {
        this.layer.setMeshSelected(this.meshId, flags, this.transparent);
    }

    setEdges(flags: number) {
        this.layer.setMeshEdges(this.meshId, flags, this.transparent);
    }

    setClippable(flags: number) {
        this.layer.setMeshClippable(this.meshId, flags);
    }

    setCollidable(flags: number) {
        this.layer.setMeshCollidable(this.meshId, flags);
    }

    setPickable(flags: number) {
        this.layer.setMeshPickable(this.meshId, flags, this.transparent);
    }

    setCulled(flags: number) {
        this.layer.setMeshCulled(this.meshId, flags, this.transparent);
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
        //this.sceneObject.sceneModel.drawPickNormals(renderContext);
    }

    delegatePickedEntity(): WebGLSceneObject {
        return this.sceneObject;
    }

    destroy() {
    }
}

export {Mesh};