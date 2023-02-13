import {Scene} from "../../core/src/Scene";
import {ModelParams} from "../../core/src/ModelParams";
import {EventEmitter, Model, XKTObject} from "@xeokit/core/components";
import {Viewer} from "./Viewer";
import {createUUID} from "@xeokit/core/utils";
import {MAX_DOUBLE, MIN_DOUBLE} from "@xeokit/math/math";
import {Renderer} from "./Renderer";

/**
 * @private
 */
export class ViewerScene implements Scene {

    readonly id: string;
    readonly models: { [p: string]: Model };
    readonly objects: { [p: string]: XKTObject };

    readonly onModelCreated: EventEmitter<Scene, Model>;
    readonly onModelDestroyed: EventEmitter<Scene, Model>;

    #viewer: Viewer;
    #renderer: Renderer;
    #center: Float64Array;
    #aabbDirty: boolean;
    #aabb: Float64Array;

    constructor(viewer: Viewer, renderer: Renderer) {
        this.#viewer = viewer;
        this.#renderer = renderer;
    }

    createModel(params: ModelParams): Model {
        params.id = params.id || createUUID();
        if (this.models[params.id]) {
            throw new Error(`Model with this ID already exists, or is under construction: "${params.id}"`);
        }
        const viewerModel = this.#renderer.createModel(params);
        this.models[viewerModel.id] = viewerModel;
        viewerModel.onBuilt.one(() => {
            this.#registerViewerObjects(viewerModel);
            this.onModelCreated.dispatch(this, viewerModel);
        });
        viewerModel.onDestroyed.one(() => {
            delete this.models[viewerModel.id];
            this.#deregisterViewerObjects(viewerModel);
            this.onModelDestroyed.dispatch(this, viewerModel);
        });
        return viewerModel;
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

    get aabb(): Float64Array {
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
    }

    #registerViewerObjects(model: Model) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            this.objects[object.id] = object;
        }
        this.#aabbDirty = true;
    }

    #deregisterViewerObjects(model: Model) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            delete this.objects[object.id];
        }
        this.#aabbDirty = true;
    }
}