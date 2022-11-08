import {SceneObject, SceneModel, math} from "../../viewer/index";
import {SceneObjectFlags} from './SceneObjectFlags';
import {Mesh} from "./Mesh";

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
    readonly viewLayer: string ;

    #meshes: Mesh[];
    #flags: number;
    #aabb: math.FloatArrayType;
    #offsetAABB: math.FloatArrayType;
    #offset: math.FloatArrayType;
    #colorizeUpdated: boolean;
    #opacityUpdated: boolean;

    constructor(params: {
        id: string,
        sceneModel: SceneModel,
        meshes: Mesh[],
        aabb: any
    }) {
        this.id = params.id;
        this.model = params.sceneModel;
        this.#meshes = params.meshes || [];
        this.#flags = 0;
        this.#aabb = params.aabb;
        this.#offsetAABB = math.boundaries.AABB3(params.aabb);
        this.#offset = math.vec3();
        this.#colorizeUpdated = false;
        this.#opacityUpdated = false;

        for (let i = 0, len = this.#meshes.length; i < len; i++) {  // TODO: tidier way? Refactor?
            const mesh = this.#meshes[i];
            mesh.setSceneObject(this);
        }
    }

    get aabb(): math.FloatArrayType {
        return this.#offsetAABB;
    }

    setVisible(viewIndex: number, visible: boolean): void {
        if (!!(this.#flags & SceneObjectFlags.VISIBLE) === visible) {
            return;
        }
        this.#flags = visible ? this.#flags | SceneObjectFlags.VISIBLE : this.#flags & ~SceneObjectFlags.VISIBLE;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setVisible(this.#flags);
        }
    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {
        if (!!(this.#flags & SceneObjectFlags.HIGHLIGHTED) === highlighted) {
            return;
        }
        this.#flags = highlighted ? this.#flags | SceneObjectFlags.HIGHLIGHTED : this.#flags & ~SceneObjectFlags.HIGHLIGHTED;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setHighlighted(this.#flags);
        }
    }

    setXRayed(viewIndex: number, xrayed: boolean): void {
        if (!!(this.#flags & SceneObjectFlags.XRAYED) === xrayed) {
            return;
        }
        this.#flags = xrayed ? this.#flags | SceneObjectFlags.XRAYED : this.#flags & ~SceneObjectFlags.XRAYED;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setXRayed(this.#flags);
        }
    }

    setSelected(viewIndex: number, selected: boolean): void {
        if (!!(this.#flags & SceneObjectFlags.SELECTED) === selected) {
            return;
        }
        this.#flags = selected ? this.#flags | SceneObjectFlags.SELECTED : this.#flags & ~SceneObjectFlags.SELECTED;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setSelected(this.#flags);
        }
    }

    setEdges(viewIndex: number, edges: boolean): void {
        if (!!(this.#flags & SceneObjectFlags.EDGES) === edges) {
            return;
        }
        this.#flags = edges ? this.#flags | SceneObjectFlags.EDGES : this.#flags & ~SceneObjectFlags.EDGES;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setEdges(this.#flags);
        }
    }

    setCulled(viewIndex: number, culled: boolean): void {
        if (!!(this.#flags & SceneObjectFlags.CULLED) === culled) {
            return;
        }
        this.#flags = culled ? this.#flags | SceneObjectFlags.CULLED : this.#flags & ~SceneObjectFlags.CULLED;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setCulled(this.#flags);
        }
    }

    setClippable(viewIndex: number, clippable: boolean): void {
        if ((!!(this.#flags & SceneObjectFlags.CLIPPABLE)) === clippable) {
            return;
        }
        this.#flags = clippable ? this.#flags | SceneObjectFlags.CLIPPABLE : this.#flags & ~SceneObjectFlags.CLIPPABLE;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setClippable(this.#flags);
        }
    }

    setCollidable(viewIndex: number, collidable: boolean): void {
        if (!!(this.#flags & SceneObjectFlags.COLLIDABLE) === collidable) {
            return;
        }
        this.#flags = collidable ? this.#flags | SceneObjectFlags.COLLIDABLE : this.#flags & ~SceneObjectFlags.COLLIDABLE;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setCollidable(this.#flags);
        }
    }

    setPickable(viewIndex: number, pickable: boolean): void {
        if (!!(this.#flags & SceneObjectFlags.PICKABLE) === pickable) {
            return;
        }
        this.#flags = pickable ? this.#flags | SceneObjectFlags.PICKABLE : this.#flags & ~SceneObjectFlags.PICKABLE;
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setPickable(this.#flags);
        }
    }

    setColorize(viewIndex: number, color?: math.FloatArrayType): void { // [0..1, 0..1, 0..1]
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
        const opacityUpdated = (opacity !== null && opacity !== undefined);
        // @ts-ignore
        const lastOpacityQuantized = this.#meshes[0].#colorize[3];
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
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].setOpacity(opacityQuantized, this.#flags);
        }
    }

    setOffset(viewIndex: number, offset: math.FloatArrayType): void {
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

    finalize(): void {
        for (let i = 0, len = this.#meshes.length; i < len; i++) {
            this.#meshes[i].finalize(this.#flags);
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