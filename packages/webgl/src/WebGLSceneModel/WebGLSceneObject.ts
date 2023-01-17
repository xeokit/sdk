import {AABB3} from "@xeokit/math/boundaries";
import {vec3} from "@xeokit/math/matrix";
import {FloatArrayParam} from "@xeokit/math/math";


import {SCENE_OBJECT_FLAGS} from './SCENE_OBJECT_FLAGS';
import type {Mesh} from "./Mesh";
import {SceneModel, SceneObject} from "@xeokit/viewer";

const tempIntRGB = new Uint16Array([0, 0, 0]);

class WebGLSceneObject implements SceneObject {

    /**
     * Unique ID of this SceneObject.
     */
    readonly id: string;

    /**
     * The SceneModel that contains this SceneObject.
     */
    readonly model: SceneModel;

    /**
     * Which {@link ViewLayer} this SceneObject belongs to.
     */
    readonly viewLayerId: string | null;

    #meshes: Mesh[];
    #flags: number;
    #aabb: FloatArrayParam;
    #offsetAABB: FloatArrayParam;
    #offset: FloatArrayParam;
    #colorizeUpdated: boolean;
    #opacityUpdated: boolean;

    constructor(params: {
        id: string,
        sceneModel: SceneModel,
        meshes: Mesh[],
        aabb: any,
        viewLayerId?: string
    }) {
        this.id = params.id;
        this.model = params.sceneModel;
        this.#meshes = params.meshes || [];
        this.#flags = 0;
        this.#aabb = params.aabb;
        this.#offsetAABB = AABB3(params.aabb);
        this.#offset = vec3();
        this.#colorizeUpdated = false;
        this.#opacityUpdated = false;

        this.viewLayerId = params.viewLayerId || null;

        for (let i = 0, len = this.#meshes.length; i < len; i++) {  // TODO: tidier way? Refactor?
            const mesh = this.#meshes[i];
            mesh.setSceneObject(this);
        }
    }

    get aabb(): FloatArrayParam {
        return this.#offsetAABB;
    }

    setVisible(viewIndex: number, visible: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.VISIBLE) === visible) {
            return;
        }
        this.#flags = visible ? this.#flags | SCENE_OBJECT_FLAGS.VISIBLE : this.#flags & ~SCENE_OBJECT_FLAGS.VISIBLE;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setVisible(this.#flags);
        }
    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) === highlighted) {
            return;
        }
        this.#flags = highlighted ? this.#flags | SCENE_OBJECT_FLAGS.HIGHLIGHTED : this.#flags & ~SCENE_OBJECT_FLAGS.HIGHLIGHTED;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setHighlighted(this.#flags);
        }
    }

    setXRayed(viewIndex: number, xrayed: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.XRAYED) === xrayed) {
            return;
        }
        this.#flags = xrayed ? this.#flags | SCENE_OBJECT_FLAGS.XRAYED : this.#flags & ~SCENE_OBJECT_FLAGS.XRAYED;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setXRayed(this.#flags);
        }
    }

    setSelected(viewIndex: number, selected: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.SELECTED) === selected) {
            return;
        }
        this.#flags = selected ? this.#flags | SCENE_OBJECT_FLAGS.SELECTED : this.#flags & ~SCENE_OBJECT_FLAGS.SELECTED;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setSelected(this.#flags);
        }
    }

    setEdges(viewIndex: number, edges: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.EDGES) === edges) {
            return;
        }
        this.#flags = edges ? this.#flags | SCENE_OBJECT_FLAGS.EDGES : this.#flags & ~SCENE_OBJECT_FLAGS.EDGES;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setEdges(this.#flags);
        }
    }

    setCulled(viewIndex: number, culled: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.CULLED) === culled) {
            return;
        }
        this.#flags = culled ? this.#flags | SCENE_OBJECT_FLAGS.CULLED : this.#flags & ~SCENE_OBJECT_FLAGS.CULLED;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setCulled(this.#flags);
        }
    }

    setClippable(viewIndex: number, clippable: boolean): void {
        if ((!!(this.#flags & SCENE_OBJECT_FLAGS.CLIPPABLE)) === clippable) {
            return;
        }
        this.#flags = clippable ? this.#flags | SCENE_OBJECT_FLAGS.CLIPPABLE : this.#flags & ~SCENE_OBJECT_FLAGS.CLIPPABLE;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setClippable(this.#flags);
        }
    }

    setCollidable(viewIndex: number, collidable: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.COLLIDABLE) === collidable) {
            return;
        }
        this.#flags = collidable ? this.#flags | SCENE_OBJECT_FLAGS.COLLIDABLE : this.#flags & ~SCENE_OBJECT_FLAGS.COLLIDABLE;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setCollidable(this.#flags);
        }
    }

    setPickable(viewIndex: number, pickable: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.PICKABLE) === pickable) {
            return;
        }
        this.#flags = pickable ? this.#flags | SCENE_OBJECT_FLAGS.PICKABLE : this.#flags & ~SCENE_OBJECT_FLAGS.PICKABLE;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setPickable(this.#flags);
        }
    }

    setColorize(viewIndex: number, color?: FloatArrayParam): void { // [0..1, 0..1, 0..1]
        if (color) {
            tempIntRGB[0] = Math.floor(color[0] * 255.0); // Quantize
            tempIntRGB[1] = Math.floor(color[1] * 255.0);
            tempIntRGB[2] = Math.floor(color[2] * 255.0);
            for (let i = 0, len = this.#meshes.length; i < len; i++) {
                this.#meshes[i].setColorize(tempIntRGB);
            }
        } else {
            for (let i = 0, len = this.#meshes.length; i < len; i++) {
                this.#meshes[i].setColorize(null);
            }
        }
    }

    setOpacity(viewIndex: number, opacity?: number): void {
        if (this.#meshes.length === 0) {
            return;
        }
        // @ts-ignore
        const lastOpacityQuantized = this.#meshes[0].colorize[3];
        let opacityQuantized = 255;
        if (opacity !== null && opacity !== undefined) {
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
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setOpacity(opacityQuantized, this.#flags);
        }
    }

    setOffset(viewIndex: number, offset: FloatArrayParam): void {
        if (offset) {
            this.#offset[0] = offset[0];
            this.#offset[1] = offset[1];
            this.#offset[2] = offset[2];
        } else {
            this.#offset[0] = 0;
            this.#offset[1] = 0;
            this.#offset[2] = 0;
        }
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setOffset(this.#offset);
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

    build(): void {
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].build(this.#flags);
        }
    }

    finalize2(): void {
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].finalize2();
        }
    }

    destroy(): void { // Called by WebGLSceneModel
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].destroy();
        }
    }
}

export {WebGLSceneObject};