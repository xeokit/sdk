
import {createAABB3} from "@xeokit/boundaries";
import {createVec3} from "@xeokit/matrix";
import type {FloatArrayParam} from "@xeokit/math";
import {SCENE_OBJECT_FLAGS} from './SCENE_OBJECT_FLAGS';
import type {WebGLRendererMesh} from "./WebGLRendererMesh";
import type {RendererViewObject} from "@xeokit/viewer";
import type {RendererSceneModel, RendererSceneObject, SceneObject} from "@xeokit/scene";

const tempIntRGB = new Uint16Array([0, 0, 0]);

/**
 * TODO
 * @internal
 */
export class WebGLRendererObject implements RendererSceneObject, RendererViewObject {

    readonly id: string;
    readonly rendererSceneModel: RendererSceneModel;
    readonly sceneObject: SceneObject;
    readonly layerId: string | null;

    readonly rendererMeshes: WebGLRendererMesh[];

    #flags: number;
    #aabb: FloatArrayParam;
    #offsetAABB: FloatArrayParam;
    #offset: FloatArrayParam;
    #colorizeUpdated: boolean;
    #opacityUpdated: boolean;

    /**
     * @private
     * @param params
     */
    constructor(params: {
        id: string,
        sceneObject: SceneObject,
        rendererSceneModel: RendererSceneModel,
        rendererMeshes: WebGLRendererMesh[],
        aabb: any,
        layerId?: string
    }) {
        this.id = params.id;
        this.sceneObject = params.sceneObject;
        this.rendererSceneModel = params.rendererSceneModel;
        this.rendererMeshes = params.rendererMeshes || [];
        this.#flags = 0;
        this.#aabb = params.aabb;
        this.#offsetAABB = createAABB3(params.aabb);
        this.#offset = createVec3();
        this.#colorizeUpdated = false;
        this.#opacityUpdated = false;

        this.layerId = params.layerId || null;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {  // TODO: tidier way? Refactor?
            this.rendererMeshes[i].setRendererObject(this);
        }
    }

    /**
     * TODO
     * @internal
     */
    get aabb(): FloatArrayParam {
        return this.#offsetAABB;
    }

    /**
     * TODO
     * @internal
     */
    setVisible(viewIndex: number, visible: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.VISIBLE) === visible) {
            return;
        }
        this.#flags = visible ? this.#flags | SCENE_OBJECT_FLAGS.VISIBLE : this.#flags & ~SCENE_OBJECT_FLAGS.VISIBLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setVisible(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setHighlighted(viewIndex: number, highlighted: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) === highlighted) {
            return;
        }
        this.#flags = highlighted ? this.#flags | SCENE_OBJECT_FLAGS.HIGHLIGHTED : this.#flags & ~SCENE_OBJECT_FLAGS.HIGHLIGHTED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setHighlighted(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setXRayed(viewIndex: number, xrayed: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.XRAYED) === xrayed) {
            return;
        }
        this.#flags = xrayed ? this.#flags | SCENE_OBJECT_FLAGS.XRAYED : this.#flags & ~SCENE_OBJECT_FLAGS.XRAYED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setXRayed(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setSelected(viewIndex: number, selected: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.SELECTED) === selected) {
            return;
        }
        this.#flags = selected ? this.#flags | SCENE_OBJECT_FLAGS.SELECTED : this.#flags & ~SCENE_OBJECT_FLAGS.SELECTED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setSelected(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setEdges(viewIndex: number, edges: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.EDGES) === edges) {
            return;
        }
        this.#flags = edges ? this.#flags | SCENE_OBJECT_FLAGS.EDGES : this.#flags & ~SCENE_OBJECT_FLAGS.EDGES;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setEdges(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setCulled(viewIndex: number, culled: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.CULLED) === culled) {
            return;
        }
        this.#flags = culled ? this.#flags | SCENE_OBJECT_FLAGS.CULLED : this.#flags & ~SCENE_OBJECT_FLAGS.CULLED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setCulled(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setClippable(viewIndex: number, clippable: boolean): void {
        if ((!!(this.#flags & SCENE_OBJECT_FLAGS.CLIPPABLE)) === clippable) {
            return;
        }
        this.#flags = clippable ? this.#flags | SCENE_OBJECT_FLAGS.CLIPPABLE : this.#flags & ~SCENE_OBJECT_FLAGS.CLIPPABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setClippable(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setCollidable(viewIndex: number, collidable: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.COLLIDABLE) === collidable) {
            return;
        }
        this.#flags = collidable ? this.#flags | SCENE_OBJECT_FLAGS.COLLIDABLE : this.#flags & ~SCENE_OBJECT_FLAGS.COLLIDABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setCollidable(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setPickable(viewIndex: number, pickable: boolean): void {
        if (!!(this.#flags & SCENE_OBJECT_FLAGS.PICKABLE) === pickable) {
            return;
        }
        this.#flags = pickable ? this.#flags | SCENE_OBJECT_FLAGS.PICKABLE : this.#flags & ~SCENE_OBJECT_FLAGS.PICKABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setPickable(this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setColorize(viewIndex: number, color?: FloatArrayParam): void { // [0..1, 0..1, 0..1]
        if (color) {
            tempIntRGB[0] = Math.floor(color[0] * 255.0); // Quantize
            tempIntRGB[1] = Math.floor(color[1] * 255.0);
            tempIntRGB[2] = Math.floor(color[2] * 255.0);
            for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
                this.rendererMeshes[i].setColorize(tempIntRGB);
            }
        } else {
            for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
                this.rendererMeshes[i].setColorize(null);
            }
        }
    }

    /**
     * TODO
     * @internal
     */
    setOpacity(viewIndex: number, opacity?: number): void {
        if (this.rendererMeshes.length === 0) {
            return;
        }
        // @ts-ignore
        const lastOpacityQuantized = this.rendererMeshes[0].colorize[3];
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
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setOpacity(opacityQuantized, this.#flags);
        }
    }

    /**
     * TODO
     * @internal
     */
    setOffset(viewIndex: number, offset: FloatArrayParam): void {
        // if (offset) {
        //     this.#offset[0] = offset[0];
        //     this.#offset[1] = offset[1];
        //     this.#offset[2] = offset[2];
        // } else {
        //     this.#offset[0] = 0;
        //     this.#offset[1] = 0;
        //     this.#offset[2] = 0;
        // }
        // for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
        //     this.rendererMeshes[i].setOffset(this.#offset);
        // }
        // this.#offsetAABB[0] = this.#aabb[0] + this.#offset[0];
        // this.#offsetAABB[1] = this.#aabb[1] + this.#offset[1];
        // this.#offsetAABB[2] = this.#aabb[2] + this.#offset[2];
        // this.#offsetAABB[3] = this.#aabb[3] + this.#offset[0];
        // this.#offsetAABB[4] = this.#aabb[4] + this.#offset[1];
        // this.#offsetAABB[5] = this.#aabb[5] + this.#offset[2];
        // // this.scene.#aabbDirty = true;
        // // this.scene._objectOffsetUpdated(this, offset);
        // // this.rendererSceneModel._aabbDirty = true;
        // // this.rendererSceneModel.glRedraw();
    }

    build(): void {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].build(this.#flags);
        }
    }

    build2(): void {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].build2();
        }
    }

    destroy(): void {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].destroy();
        }
    }
}
