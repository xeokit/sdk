import {EventEmitter} from "@xeokit/core/components";
import {FloatArrayParam, MAX_DOUBLE, MIN_DOUBLE} from "@xeokit/math/math";
import {EventDispatcher} from "strongly-typed-events";
import {Tiles} from "@xeokit/viewer/src/Tiles";
import {SceneModel} from "./SceneModel";
import {SceneObject} from "./SceneObject";
import {CreateSceneModelParams} from "./CreateSceneModelParams";

/**
 * A scene representation.
 *
 * A Scene is a container of {@link SceneModel | SceneModels} and {@link SceneObject | SceneObjects}.
 */
export class Scene {

    /**
     * The SceneModels in this Scene.
     */
    readonly models: { [key: string]: SceneModel };

    /**
     * SceneObjects in this Scene.
     */
    readonly objects: { [key: string]: SceneObject };

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

    #onModelBuilts: { [key: string]: any };
    #onModelDestroys: { [key: string]: any };
    #center: Float64Array;
    #aabbDirty: boolean;
    #aabb: Float64Array;

    /**
     * TODO
     */
    constructor() {
        this.#onModelBuilts = {};
        this.#onModelDestroys = {};
        this.onModelCreated = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
        this.onModelDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    }

    /**
     * TODO
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
     * TOSO
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
     * Creates a {@link @xeokit/scene!SceneModel} in this Scene.
     *
     * @param params SceneModel configuration
     * @returns The new SceneModel
     */
    createModel(params: CreateSceneModelParams): SceneModel {
        if (!params.id) {
            throw new Error("Parameter expected: id");
        }
        if (this.models[params.id]) {
            throw new Error(`SceneModel with this ID already created in this Scene: "${params.id}"`);
        }
        const id = params.id;
        const sceneModel = new SceneModel({id});
        this.models[id] = sceneModel;
        this.#registerObjects(sceneModel);
        this.onModelCreated.dispatch(this, sceneModel);
        this.#onModelBuilts[id] =  sceneModel.onBuilt.one(() => {
            this.#registerObjects(sceneModel);
            this.onModelCreated.dispatch(this, sceneModel);
        });
        this.#onModelDestroys[id] = sceneModel.onDestroyed.one(() => {
            delete this.models[id];
            this.#deregisterObjects(sceneModel);
            sceneModel.onBuilt.unsubscribe(this.#onModelBuilts[id]);
            sceneModel.onDestroyed.unsubscribe(this.#onModelDestroys[id]);
            this.onModelDestroyed.dispatch(this, sceneModel);
        });
        return sceneModel;
    }

    #registerObjects(model: SceneModel) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            this.objects[object.id] = <SceneObject>object;
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


    /**
     * Removes all {@link @xeokit/scene!SceneModel | SceneModels} currently in this Scene.
     */
    removeAllModels() {
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

    // /**
    //  * @private
    //  */
    // setVisible(object: SceneObject, viewIndex: number, visible: boolean): void {
    //     (<SceneObject>object).setVisible(viewIndex, visible);
    // }
    //
    // /**
    //  * @private
    //  */
    // setHighlighted(object: SceneObject, viewIndex: number, highlighted: boolean): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setXRayed(object: SceneObject, viewIndex: number, xrayed: boolean): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setSelected(object: SceneObject, viewIndex: number, selected: boolean): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setEdges(object: SceneObject, viewIndex: number, edges: boolean): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setCulled(object: SceneObject, viewIndex: number, culled: boolean): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setClippable(object: SceneObject, viewIndex: number, clippable: boolean): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setCollidable(object: SceneObject, viewIndex: number, collidable: boolean): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setPickable(object: SceneObject, viewIndex: number, pickable: boolean): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setColorize(object: SceneObject, viewIndex: number, color?: FloatArrayParam): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setOpacity(object: SceneObject, viewIndex: number, opacity?: number): void {
    //
    // }
    //
    // /**
    //  * @private
    //  */
    // setOffset(object: SceneObject, viewIndex: number, offset: FloatArrayParam): void {
    //
    // }

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
}