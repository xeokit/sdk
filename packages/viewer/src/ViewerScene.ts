import {Scene} from "../../core/src/Scene";
import {ModelParams} from "../../core/src/ModelParams";
import {EventEmitter, Model, XKTObject} from "@xeokit/core/components";
import {createUUID} from "@xeokit/core/utils";
import {FloatArrayParam, MAX_DOUBLE, MIN_DOUBLE} from "@xeokit/math/math";
import {Renderer} from "./Renderer";
import {Tiles} from "./Tiles";
import {EventDispatcher} from "strongly-typed-events";
import {ViewerObject} from "./ViewerObject";

/**
 * @private
 */
export class ViewerScene implements Scene {

    readonly id: string;
    readonly models: { [p: string]: Model };
    readonly objects: { [p: string]: ViewerObject };
    readonly tiles: Tiles;

    readonly onModelCreated: EventEmitter<Scene, Model>;
    readonly onModelDestroyed: EventEmitter<Scene, Model>;

    #renderer: Renderer;
    #center: Float64Array;
    #aabbDirty: boolean;
    #aabb: Float64Array;

    constructor(renderer: Renderer) {
        this.#renderer = renderer;

        this.onModelCreated = new EventEmitter(new EventDispatcher<Scene, Model>());
        this.onModelDestroyed = new EventEmitter(new EventDispatcher<Scene, Model>());
    }

    get center(): Float64Array {
        if (this.#aabbDirty) {
            const aabb = this.aabb; // Lazy-build
            this.#center[0] = (aabb[0] + aabb[3]) / 2;
            this.#center[1] = (aabb[1] + aabb[4]) / 2;
            this.#center[2] = (aabb[2] + aabb[5]) / 2;
        }
        return this.#center;
    }

    get aabb(): FloatArrayParam {
        if (this.#aabbDirty) {
            let xmin = MAX_DOUBLE;
            let ymin = MAX_DOUBLE;
            let zmin = MAX_DOUBLE;
            let xmax = MIN_DOUBLE;
            let ymax = MIN_DOUBLE;
            let zmax = MIN_DOUBLE;
            let aabb;
            const objects = this.objects;
            let valid = false;
            for (const objectId in objects) {
                if (objects.hasOwnProperty(objectId)) {
                    const object = objects[objectId];
                    // if (object.collidable === false) {
                    //     continue;
                    // }
                    aabb = object.aabb;
                    if (aabb[0] < xmin) {
                        xmin = aabb[0];
                    }
                    if (aabb[1] < ymin) {
                        ymin = aabb[1];
                    }
                    if (aabb[2] < zmin) {
                        zmin = aabb[2];
                    }
                    if (aabb[3] > xmax) {
                        xmax = aabb[3];
                    }
                    if (aabb[4] > ymax) {
                        ymax = aabb[4];
                    }
                    if (aabb[5] > zmax) {
                        zmax = aabb[5];
                    }
                    valid = true;
                }
            }
            if (!valid) {
                xmin = -100;
                ymin = -100;
                zmin = -100;
                xmax = 100;
                ymax = 100;
                zmax = 100;
            }
            this.#aabb[0] = xmin;
            this.#aabb[1] = ymin;
            this.#aabb[2] = zmin;
            this.#aabb[3] = xmax;
            this.#aabb[4] = ymax;
            this.#aabb[5] = zmax;
            this.#aabbDirty = false;
        }
        return this.#aabb;
    }

    createModel(params: ModelParams): Model {
        params.id = params.id || createUUID();
        if (this.models[params.id]) {
            throw new Error(`Model with this ID already exists, or is under construction: "${params.id}"`);
        }
        const viewerModel = this.#renderer.createModel(params);
        this.models[viewerModel.id] = viewerModel;
        viewerModel.onBuilt.one(() => {
            this.#registerObjects(viewerModel);
            this.onModelCreated.dispatch(this, viewerModel);
        });
        viewerModel.onDestroyed.one(() => {
            delete this.models[viewerModel.id];
            this.#deregisterObjects(viewerModel);
            this.onModelDestroyed.dispatch(this, viewerModel);
        });
        return viewerModel;
    }

    /**
     * @private
     */
    setVisible(object: XKTObject, viewIndex: number, visible: boolean): void {
        ((<ViewerObject>object).setVisible(viewIndex, visible));
    }

    /**
     * @private
     */
    setHighlighted(object: XKTObject, viewIndex: number, highlighted: boolean): void {

    }

    /**
     * @private
     */
    setXRayed(object: XKTObject, viewIndex: number, xrayed: boolean): void{}

    /**
     * @private
     */
    setSelected(object: XKTObject, viewIndex: number, selected: boolean): void{}

    /**
     * @private
     */
    setEdges(object: XKTObject, viewIndex: number, edges: boolean): void{}

    /**
     * @private
     */
    setCulled(object: XKTObject, viewIndex: number, culled: boolean): void{}

    /**
     * @private
     */
    setClippable(object: XKTObject, viewIndex: number, clippable: boolean): void{}

    /**
     * @private
     */
    setCollidable(object: XKTObject, viewIndex: number, collidable: boolean): void{}

    /**
     * @private
     */
    setPickable(object: XKTObject, viewIndex: number, pickable: boolean): void{}

    /**
     * @private
     */
    setColorize(object: XKTObject, viewIndex: number, color?: FloatArrayParam): void{}

    /**
     * @private
     */
    setOpacity(object: XKTObject, viewIndex: number, opacity?: number): void{}

    /**
     * @private
     */
    setOffset(object: XKTObject, viewIndex: number, offset: FloatArrayParam): void {
    }


    clear() {
        for (let id in this.models) {
            this.models[id].destroy();
        }
    }

    setAABBDirty() {
        if (!this.#aabbDirty) {
            this.#aabbDirty = true;
            //this.events.fire("aabb", true);
        }
    }

    destroy(): void {
        this.onModelCreated.clear();
        this.onModelDestroyed.clear();
        for (let id in this.models) {
            this.models[id].destroy();
        }
    }

    #registerObjects(model: Model) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            this.objects[object.id] = <ViewerObject>object;
        }
        this.#aabbDirty = true;
    }

    #deregisterObjects(model: Model) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            delete this.objects[object.id];
        }
        this.#aabbDirty = true;
    }
}