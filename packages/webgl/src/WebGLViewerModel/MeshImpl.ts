import {Mesh} from "@xeokit/core/components";
import {FloatArrayParam} from "@xeokit/math/math";
import {createAABB3} from "@xeokit/math/boundaries";

import type {Pickable} from "../Pickable";
import type {ViewerObjectImpl} from "./ViewerObjectImpl";
import type {RenderContext} from "../RenderContext";
import type {Layer} from "./Layer";
import {TextureSetImpl} from "./TextureSetImpl";
import {GeometryImpl} from "./GeometryImpl";


/**
 * @private
 */
export class MeshImpl implements Mesh, Pickable {

    id: string;
    pickId: number;
    viewerObject: ViewerObjectImpl | null;
    aabb: FloatArrayParam;
    layer: Layer;
    meshIndex: number;
    color: FloatArrayParam;
    geometry: GeometryImpl;
    textureSet: TextureSetImpl;
    matrix: FloatArrayParam;
    metallic: number;
    roughness: number;
    opacity: number;
    colorize: FloatArrayParam;
    colorizing: boolean;
    transparent: boolean;

    constructor(params: {
        layer: Layer,
        id: string,
        matrix: FloatArrayParam;
        metallic: number;
        roughness: number;
        color: FloatArrayParam,
        opacity: number,
        textureSet: TextureSetImpl
        geometry: GeometryImpl,
        meshIndex: number
    }) {
        this.viewerObject = null;
        this.id = params.id;
        this.pickId = 0;
        this.color = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        this.colorize = [params.color[0], params.color[1], params.color[2], params.opacity]; // [0..255]
        this.colorizing = false;
        this.transparent = (params.opacity < 255);
        this.viewerObject = null;
        this.layer = params.layer;
        this.matrix = params.matrix;
        this.metallic = params.metallic;
        this.roughness = params.roughness;
        this.opacity = params.opacity;
        this.aabb = createAABB3();
        this.textureSet = params.textureSet;
        this.geometry = params.geometry;
        this.meshIndex = params.meshIndex;
    }

    setSceneObject(viewerObject: ViewerObjectImpl) {
        this.viewerObject = viewerObject;
    }

    build(flags: number) {
        // @ts-ignore
        this.layer.initFlags(this.meshIndex, flags, this.transparent);
    }

    finalize2() {
        // @ts-ignore
        if (this.layer.flushInitFlags) {
            this.layer.flushInitFlags();
        }
    }

    setVisible(flags: any) {
        this.layer.setMeshVisible(this.meshIndex, flags, this.transparent);
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

    setOffset(offset: FloatArrayParam) {
        this.layer.setMeshOffset(this.meshIndex, offset);
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
        //this.viewerObject.viewerModel.drawPickNormals(renderContext);
    }

    delegatePickedEntity(): ViewerObjectImpl {
        return <ViewerObjectImpl>this.viewerObject;
    }

    destroy() {
    }
}
