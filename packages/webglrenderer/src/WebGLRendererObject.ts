import {createAABB3} from "@xeokit/boundaries";
import {createVec3} from "@xeokit/matrix";
import type {FloatArrayParam} from "@xeokit/math";
import {SCENE_OBJECT_FLAGS} from './SCENE_OBJECT_FLAGS';
import type {WebGLRendererMesh} from "./WebGLRendererMesh";
import type {RendererModel, RendererObject} from "@xeokit/scene";

const tempIntRGB = new Uint16Array([0, 0, 0]);

/**
 * @private
 */
export class WebGLRendererObject implements RendererObject {

    readonly id: string;
    readonly rendererModel: RendererModel;
    readonly layerId: string | null;

    readonly rendererMeshes: WebGLRendererMesh[];

    #flags: number[];
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
        rendererModel: RendererModel,
        rendererMeshes: WebGLRendererMesh[],
        aabb: any,
        layerId?: string
    }) {
        this.id = params.id;
        this.rendererModel = params.rendererModel;
        this.rendererMeshes = params.rendererMeshes || [];

        ///////////////////////////////////
        // FIXME: start off at 1,1,1,1 ?
        ///////////////////////////////////

        this.#flags = [0, 0, 0, 0];
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

    get aabb(): FloatArrayParam {
        return this.#offsetAABB;
    }

    setVisible(viewIndex: number, visible: boolean): void {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.VISIBLE) === visible) {
            return;
        }
        this.#flags[viewIndex] = visible ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.VISIBLE : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.VISIBLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setVisible(viewIndex, this.#flags[viewIndex]);
        }
    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.HIGHLIGHTED) === highlighted) {
            return;
        }
        this.#flags[viewIndex] = highlighted ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.HIGHLIGHTED : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.HIGHLIGHTED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setHighlighted(viewIndex, this.#flags[viewIndex]);
        }
    }

    setXRayed(viewIndex: number, xrayed: boolean): void {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.XRAYED) === xrayed) {
            return;
        }
        this.#flags[viewIndex] = xrayed ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.XRAYED : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.XRAYED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setXRayed(viewIndex, this.#flags[viewIndex]);
        }
    }

    setSelected(viewIndex: number, selected: boolean): void {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.SELECTED) === selected) {
            return;
        }
        this.#flags[viewIndex] = selected ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.SELECTED : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.SELECTED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setSelected(viewIndex, this.#flags[viewIndex]);
        }
    }

    setCulled(viewIndex: number, culled: boolean): void {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.CULLED) === culled) {
            return;
        }
        this.#flags[viewIndex] = culled ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.CULLED : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.CULLED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setCulled(viewIndex, this.#flags[viewIndex]);
        }
    }

    setClippable(viewIndex: number, clippable: boolean): void {
        if ((!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.CLIPPABLE)) === clippable) {
            return;
        }
        this.#flags[viewIndex] = clippable ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.CLIPPABLE : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.CLIPPABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setClippable(viewIndex, this.#flags[viewIndex]);
        }
    }

    setCollidable(viewIndex: number, collidable: boolean): void {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.COLLIDABLE) === collidable) {
            return;
        }
        this.#flags[viewIndex] = collidable ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.COLLIDABLE : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.COLLIDABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setCollidable(viewIndex, this.#flags[viewIndex]);
        }
    }

    setPickable(viewIndex: number, pickable: boolean): void {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.PICKABLE) === pickable) {
            return;
        }
        this.#flags[viewIndex] = pickable ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.PICKABLE : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.PICKABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setPickable(viewIndex, this.#flags[viewIndex]);
        }
    }

    setColorize(viewIndex: number, color?: FloatArrayParam): void { // [0..1, 0..1, 0..1]
        if (color) {
            tempIntRGB[0] = Math.floor(color[0] * 255.0); // Quantize
            tempIntRGB[1] = Math.floor(color[1] * 255.0);
            tempIntRGB[2] = Math.floor(color[2] * 255.0);
            for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
                this.rendererMeshes[i].setColorize(viewIndex, tempIntRGB);
            }
        } else {
            for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
                this.rendererMeshes[i].setColorize(viewIndex, null);
            }
        }
    }

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
            // @ts-ignore
            if (lastOpacityQuantized === opacityQuantized) {
                return;
            }
        } else {
            opacityQuantized = 255.0;
            // @ts-ignore
            if (lastOpacityQuantized === opacityQuantized) {
                return;
            }
        }
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setOpacity(viewIndex, opacityQuantized, this.#flags[viewIndex]);
        }
    }

    setOffset(viewIndex: number, offset: FloatArrayParam): void {
        // TODO
    }

    initFlags(viewIndex: number): void {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].initFlags(viewIndex, this.#flags[viewIndex]);
        }
    }

    commitRendererState(viewIndex: number): void {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].commitRendererState(viewIndex);
        }
    }

    destroy(): void {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].destroy();
        }
    }
}
