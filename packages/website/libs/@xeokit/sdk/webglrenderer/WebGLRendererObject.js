import { createAABB3 } from "../boundaries";
import { createVec3 } from "../matrix";
import { SCENE_OBJECT_FLAGS } from './SCENE_OBJECT_FLAGS';
const tempIntRGB = new Uint16Array([0, 0, 0]);
/**
 * @private
 */
export class WebGLRendererObject {
    id;
    rendererModel;
    layerId;
    rendererMeshes;
    #flags;
    #aabb;
    #offsetAABB;
    #offset;
    #colorizeUpdated;
    #opacityUpdated;
    /**
     * @private
     * @param params
     */
    constructor(params) {
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
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) { // TODO: tidier way? Refactor?
            this.rendererMeshes[i].setRendererObject(this);
        }
    }
    get aabb() {
        return this.#offsetAABB;
    }
    setVisible(viewIndex, visible) {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.VISIBLE) === visible) {
            return;
        }
        this.#flags[viewIndex] = visible ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.VISIBLE : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.VISIBLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setVisible(viewIndex, this.#flags[viewIndex]);
        }
    }
    setHighlighted(viewIndex, highlighted) {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.HIGHLIGHTED) === highlighted) {
            return;
        }
        this.#flags[viewIndex] = highlighted ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.HIGHLIGHTED : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.HIGHLIGHTED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setHighlighted(viewIndex, this.#flags[viewIndex]);
        }
    }
    setXRayed(viewIndex, xrayed) {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.XRAYED) === xrayed) {
            return;
        }
        this.#flags[viewIndex] = xrayed ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.XRAYED : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.XRAYED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setXRayed(viewIndex, this.#flags[viewIndex]);
        }
    }
    setSelected(viewIndex, selected) {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.SELECTED) === selected) {
            return;
        }
        this.#flags[viewIndex] = selected ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.SELECTED : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.SELECTED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setSelected(viewIndex, this.#flags[viewIndex]);
        }
    }
    setCulled(viewIndex, culled) {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.CULLED) === culled) {
            return;
        }
        this.#flags[viewIndex] = culled ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.CULLED : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.CULLED;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setCulled(viewIndex, this.#flags[viewIndex]);
        }
    }
    setClippable(viewIndex, clippable) {
        if ((!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.CLIPPABLE)) === clippable) {
            return;
        }
        this.#flags[viewIndex] = clippable ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.CLIPPABLE : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.CLIPPABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setClippable(viewIndex, this.#flags[viewIndex]);
        }
    }
    setCollidable(viewIndex, collidable) {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.COLLIDABLE) === collidable) {
            return;
        }
        this.#flags[viewIndex] = collidable ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.COLLIDABLE : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.COLLIDABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setCollidable(viewIndex, this.#flags[viewIndex]);
        }
    }
    setPickable(viewIndex, pickable) {
        if (!!(this.#flags[viewIndex] & SCENE_OBJECT_FLAGS.PICKABLE) === pickable) {
            return;
        }
        this.#flags[viewIndex] = pickable ? this.#flags[viewIndex] | SCENE_OBJECT_FLAGS.PICKABLE : this.#flags[viewIndex] & ~SCENE_OBJECT_FLAGS.PICKABLE;
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].setPickable(viewIndex, this.#flags[viewIndex]);
        }
    }
    setColorize(viewIndex, color) {
        if (color) {
            tempIntRGB[0] = Math.floor(color[0] * 255.0); // Quantize
            tempIntRGB[1] = Math.floor(color[1] * 255.0);
            tempIntRGB[2] = Math.floor(color[2] * 255.0);
            for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
                this.rendererMeshes[i].setColorize(viewIndex, tempIntRGB);
            }
        }
        else {
            for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
                this.rendererMeshes[i].setColorize(viewIndex, null);
            }
        }
    }
    setOpacity(viewIndex, opacity) {
        if (this.rendererMeshes.length === 0) {
            return;
        }
        // @ts-ignore
        const lastOpacityQuantized = this.rendererMeshes[0].colorize[3];
        let opacityQuantized = 255;
        if (opacity !== null && opacity !== undefined) {
            if (opacity < 0) {
                opacity = 0;
            }
            else if (opacity > 1) {
                opacity = 1;
            }
            opacityQuantized = Math.floor(opacity * 255.0); // Quantize
            // @ts-ignore
            if (lastOpacityQuantized === opacityQuantized) {
                return;
            }
        }
        else {
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
    setOffset(viewIndex, offset) {
        // TODO
    }
    initFlags(viewIndex) {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].initFlags(viewIndex, this.#flags[viewIndex]);
        }
    }
    commitRendererState(viewIndex) {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].commitRendererState(viewIndex);
        }
    }
    destroy() {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].destroy();
        }
    }
}
//# sourceMappingURL=WebGLRendererObject.js.map