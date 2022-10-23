import {ENTITY_FLAGS} from './ENTITY_FLAGS';
import {SceneObject} from "../../../viewer/scene/SceneObject";
import {SceneModel} from "../../../viewer/scene/SceneModel";
import {Mesh} from "./Mesh";
import {WebGL2SceneModel} from "../WebGL2SceneModel";
import {FloatArrayType} from "../../../viewer/math/math";
import {AABB3} from "../../../viewer/math/boundaries";
import {vec3} from "../../../viewer/math/vector";
import {unglobalizeObjectId} from "../../../viewer/utils/globalizeIDs";

const tempFloatRGB = new Float32Array([0, 0, 0]);
const tempIntRGB = new Uint16Array([0, 0, 0]);

class WebGLSceneObject implements SceneObject {

    readonly id: string;
    readonly originalSystemId: string;
    readonly sceneModel: SceneModel;

    readonly meshes: Mesh[];

    #numTriangles: number;
    #flags: number;
    #aabb: FloatArrayType;
    #offsetAABB: FloatArrayType;
    #offset: FloatArrayType;
    #colorizeUpdated: boolean;
    #opacityUpdated: boolean;

    constructor(params: {
        id: string,
        sceneModel: WebGL2SceneModel,
        meshes: Mesh[],
        aabb: any
    }) {
        this.id = params.id;
        this.originalSystemId = unglobalizeObjectId(params.sceneModel.id, params.id);

        // @ts-ignore
        this.sceneModel = params.sceneModel;
        this.meshes = params.meshes || [];

        this.#numTriangles = 0;
        this.#flags = 0;
        this.#aabb = params.aabb;
        this.#offsetAABB = AABB3(params.aabb);

        this.#offset = vec3();
        this.#colorizeUpdated = false;
        this.#opacityUpdated = false;

        for (let i = 0, len = this.meshes.length; i < len; i++) {  // TODO: tidier way? Refactor?
            const mesh = this.meshes[i];
            mesh.setSceneObject(this);
            this.#numTriangles += mesh.numTriangles;
        }
    }

    get aabb() {
        return this.#offsetAABB;
    }

    setVisible(viewIndex: number, visible: boolean): void {
        if (!!(this.#flags & ENTITY_FLAGS.VISIBLE) === visible) {
            return; // Redundant update
        }
        if (visible) {
            this.#flags = this.#flags | ENTITY_FLAGS.VISIBLE;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.VISIBLE;
        }
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setVisible(this.#flags);
        }
    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {
        if (!!(this.#flags & ENTITY_FLAGS.HIGHLIGHTED) === highlighted) {
            return; // Redundant update
        }
        if (highlighted) {
            this.#flags = this.#flags | ENTITY_FLAGS.HIGHLIGHTED;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.HIGHLIGHTED;
        }
        for (var i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setHighlighted(this.#flags);
        }
    }

    setXRayed(viewIndex: number, xrayed: boolean): void {
        if (!!(this.#flags & ENTITY_FLAGS.XRAYED) === xrayed) {
            return; // Redundant update
        }
        if (xrayed) {
            this.#flags = this.#flags | ENTITY_FLAGS.XRAYED;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.XRAYED;
        }
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setXRayed(this.#flags);
        }
    }

    setSelected(viewIndex: number, selected: boolean): void {
        if (!!(this.#flags & ENTITY_FLAGS.SELECTED) === selected) {
            return; // Redundant update
        }
        if (selected) {
            this.#flags = this.#flags | ENTITY_FLAGS.SELECTED;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.SELECTED;
        }
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setSelected(this.#flags);
        }
    }

    setEdges(viewIndex: number, edges: boolean): void {
        if (!!(this.#flags & ENTITY_FLAGS.EDGES) === edges) {
            return; // Redundant update
        }
        if (edges) {
            this.#flags = this.#flags | ENTITY_FLAGS.EDGES;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.EDGES;
        }
        for (var i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setEdges(this.#flags);
        }
    }

    setCulled(viewIndex: number, culled: boolean): void {
        if (!!(this.#flags & ENTITY_FLAGS.CULLED) === culled) {
            return; // Redundant update
        }
        if (culled) {
            this.#flags = this.#flags | ENTITY_FLAGS.CULLED;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.CULLED;
        }
        for (var i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setCulled(this.#flags);
        }
    }

    setClippable(viewIndex: number, clippable: boolean): void {
        if ((!!(this.#flags & ENTITY_FLAGS.CLIPPABLE)) === clippable) {
            return; // Redundant update
        }
        if (clippable) {
            this.#flags = this.#flags | ENTITY_FLAGS.CLIPPABLE;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.CLIPPABLE;
        }
        for (var i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setClippable(this.#flags);
        }
    }

    setCollidable(viewIndex: number, collidable: boolean): void {
        if (!!(this.#flags & ENTITY_FLAGS.COLLIDABLE) === collidable) {
            return; // Redundant update
        }
        if (collidable) {
            this.#flags = this.#flags | ENTITY_FLAGS.COLLIDABLE;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.COLLIDABLE;
        }
        for (var i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setCollidable(this.#flags);
        }
    }

    setPickable(viewIndex: number, pickable: boolean): void {
        if (!!(this.#flags & ENTITY_FLAGS.PICKABLE) === pickable) {
            return; // Redundant update
        }
        if (pickable) {
            this.#flags = this.#flags | ENTITY_FLAGS.PICKABLE;
        } else {
            this.#flags = this.#flags & ~ENTITY_FLAGS.PICKABLE;
        }
        for (var i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setPickable(this.#flags);
        }
    }

    setColorize(viewIndex: number, color?: FloatArrayType): void { // [0..1, 0..1, 0..1]
        if (color) {
            tempIntRGB[0] = Math.floor(color[0] * 255.0); // Quantize
            tempIntRGB[1] = Math.floor(color[1] * 255.0);
            tempIntRGB[2] = Math.floor(color[2] * 255.0);
            for (let i = 0, len = this.meshes.length; i < len; i++) {
                this.meshes[i].setColorize(tempIntRGB);
            }
        } else {
            for (let i = 0, len = this.meshes.length; i < len; i++) {
                this.meshes[i].setColorize(null);
            }
        }
    }

    setOpacity(viewIndex: number, opacity?: number): void {
        if (this.meshes.length === 0) {
            return;
        }
        const opacityUpdated = (opacity !== null && opacity !== undefined);
        // @ts-ignore
        const lastOpacityQuantized = this.meshes[0].#colorize[3];
        let opacityQuantized = 255;
        if (opacityUpdated) {
            if (opacity < 0) {
                opacity = 0;
            } else if (opacity > 1) {
                opacity = 1;
            }
            opacityQuantized = Math.floor(opacity * 255.0); // Quantize
            if (lastOpacityQuantized === opacityQuantized) {
                return;
            }
        } else {
            opacityQuantized = 255.0;
            if (lastOpacityQuantized === opacityQuantized) {
                return;
            }
        }
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setOpacity(opacityQuantized, this.#flags);
        }
    }

    setOffset(viewIndex: number, offset: FloatArrayType) {
        if (offset) {
            this.#offset[0] = offset[0];
            this.#offset[1] = offset[1];
            this.#offset[2] = offset[2];
        } else {
            this.#offset[0] = 0;
            this.#offset[1] = 0;
            this.#offset[2] = 0;
        }
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].setOffset(this.#offset);
        }
        this.#offsetAABB[0] = this.#aabb[0] + this.#offset[0];
        this.#offsetAABB[1] = this.#aabb[1] + this.#offset[1];
        this.#offsetAABB[2] = this.#aabb[2] + this.#offset[2];
        this.#offsetAABB[3] = this.#aabb[3] + this.#offset[0];
        this.#offsetAABB[4] = this.#aabb[4] + this.#offset[1];
        this.#offsetAABB[5] = this.#aabb[5] + this.#offset[2];
        // this.scene.#aabbDirty = true;
        // this.scene._objectOffsetUpdated(this, offset);
        // this.sceneModel._aabbDirty = true;
        // this.sceneModel.glRedraw();
    }

    finalize() {
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].finalize(this.#flags);
        }
    }

    finalize2() {
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].finalize2();
        }
    }

    destroy() { // Called by WebGL2SceneModel
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            this.meshes[i].destroy();
        }
    }
}

export {WebGLSceneObject};