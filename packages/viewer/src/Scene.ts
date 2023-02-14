import {ModelParams} from "./ModelParams";
import {EventEmitter, SceneModel, SceneObject} from "@xeokit/core/components";
import {createUUID} from "@xeokit/core/utils";
import {FloatArrayParam, MAX_DOUBLE, MIN_DOUBLE} from "@xeokit/math/math";
import {Renderer} from "./Renderer";
import {Tiles} from "./Tiles";
import {EventDispatcher} from "strongly-typed-events";
import {ViewerObject} from "./ViewerObject";

/**
 * A scene representation.
 *
 * A Scene is a container of {@link SceneModel | Models} and {@link SceneObject | SceneObjects}.
 */
export class Scene  {

    /**
     * The Scene's ID.
     */
    readonly id: string;

    /**
     * The Models in this Scene.
     */
    readonly models: { [key: string]: SceneModel };

    /**
     * Objects in this Scene.
     */
    readonly objects: { [key: string]: ViewerObject };

    /**
     * Emits an event each time a {@link SceneModel} is created in this Scene.
     *
     * @event
     */
    readonly onModelCreated: EventEmitter<Scene, SceneModel>;

    /**
     * Emits an event each time a {@link SceneModel} is destroyed in this Scene.
     *
     * @event
     */
    readonly onModelDestroyed: EventEmitter<Scene, SceneModel>;

    readonly tiles: Tiles;

    #renderer: Renderer;
    #center: Float64Array;
    #aabbDirty: boolean;
    #aabb: Float64Array;

    /**
     * @private
     */
    constructor(renderer: Renderer) {
        this.#renderer = renderer;

        this.onModelCreated = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
        this.onModelDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    }

    /**
     * @private
     */
    get center(): Float64Array {
        if (this.#aabbDirty) {
            const aabb = this.aabb; // Lazy-build
            this.#center[0] = (aabb[0] + aabb[3]) / 2;
            this.#center[1] = (aabb[1] + aabb[4]) / 2;
            this.#center[2] = (aabb[2] + aabb[5]) / 2;
        }
        return this.#center;
    }

    /**
     * @private
     */
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

    /**
     * Creates a new {@link @xeokit/core/components!SceneModel | SceneModel} within this Scene.
     *
     * @param params SceneModel configuration
     */
    createModel(params: ModelParams): SceneModel {
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
     * Destroys all the {@link @xeokit/core/components!SceneModel | Models} within this Scene.
     *
     * @param params SceneModel configuration
     */
    clear() {
        for (let id in this.models) {
            this.models[id].destroy();
        }
    }

    /**
     * @private
     */
    setAABBDirty() {
        if (!this.#aabbDirty) {
            this.#aabbDirty = true;
            //this.events.fire("aabb", true);
        }
    }

    /**
     * @private
     */
    setVisible(object: SceneObject, viewIndex: number, visible: boolean): void {
        (<ViewerObject>object).setVisible(viewIndex,visible);
    }

    /**
     * @private
     */
    setHighlighted(object: SceneObject, viewIndex: number, highlighted: boolean): void {

    }

    /**
     * @private
     */
    setXRayed(object: SceneObject, viewIndex: number, xrayed: boolean): void {

    }

    /**
     * @private
     */
    setSelected(object: SceneObject, viewIndex: number, selected: boolean): void {

    }

    /**
     * @private
     */
    setEdges(object: SceneObject, viewIndex: number, edges: boolean): void {

    }

    /**
     * @private
     */
    setCulled(object: SceneObject, viewIndex: number, culled: boolean): void {

    }

    /**
     * @private
     */
    setClippable(object: SceneObject, viewIndex: number, clippable: boolean): void {

    }

    /**
     * @private
     */
    setCollidable(object: SceneObject, viewIndex: number, collidable: boolean): void {

    }

    /**
     * @private
     */
    setPickable(object: SceneObject, viewIndex: number, pickable: boolean): void {

    }

    /**
     * @private
     */
    setColorize(object: SceneObject, viewIndex: number, color?: FloatArrayParam): void {

    }

    /**
     * @private
     */
    setOpacity(object: SceneObject, viewIndex: number, opacity?: number): void {

    }

    /**
     * @private
     */
    setOffset(object: SceneObject, viewIndex: number, offset: FloatArrayParam): void {

    }

    /**
     * @private
     */
    destroy(): void {
        this.onModelCreated.clear();
        this.onModelDestroyed.clear();
        for (let id in this.models) {
            this.models[id].destroy();
        }
    }

    #registerObjects(model: SceneModel) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            this.objects[object.id] = <ViewerObject>object;
        }
        this.#aabbDirty = true;
    }

    #deregisterObjects(model: SceneModel) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            delete this.objects[object.id];
        }
        this.#aabbDirty = true;
    }
}