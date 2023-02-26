import {AddModelParams} from "./AddModelParams";
import {EventEmitter, SceneModel, SceneObject} from "@xeokit/core/components";
import {FloatArrayParam, MAX_DOUBLE, MIN_DOUBLE} from "@xeokit/math/math";
import {Renderer} from "./Renderer";
import {Tiles} from "./Tiles";
import {EventDispatcher} from "strongly-typed-events";

/**
 * A scene representation.
 *
 * A Scene is a container of {@link SceneModel | Models} and {@link SceneObject | SceneObjects}.
 */
export class Scene {

    /**
     * The Scene's ID.
     */
    readonly id: string;

    /**
     * The SceneModel in this Scene.
     */
    readonly models: { [key: string]: SceneModel };

    /**
     * SceneObject in this Scene.
     */
    readonly objects: { [key: string]: SceneObject };

    /**
     * Emits an event each time a {@link SceneModel} is added to this Scene.
     *
     * @event
     */
    readonly onModelAdded: EventEmitter<Scene, SceneModel>;

    /**
     * Emits an event each time a {@link SceneModel} is removed from this Scene.
     *
     * @event
     */
    readonly onModelRemoved: EventEmitter<Scene, SceneModel>;

    readonly tiles: Tiles;

    #onModelDestroys: { [key: string]: any };
    #renderer: Renderer;
    #center: Float64Array;
    #aabbDirty: boolean;
    #aabb: Float64Array;

    /**
     * @private
     */
    constructor(renderer: Renderer) {
        this.#onModelDestroys = {};
        this.#renderer = renderer;
        this.onModelAdded = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
        this.onModelRemoved = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
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
     * Adds a {@link @xeokit/core/components!SceneModel | SceneModel} to this Scene.
     *
     * * A SceneModel may belong to one Scene at a time.
     * * The SceneModel will be automatically removed when the SceneModel is destroyed.
     * * All SceneModels will be automatically removed when this Scene is destroyed.
     * * SceneModels are not destroyed when you remove them.
     *
     * @param params SceneModel configuration
     */
    addModel(params: AddModelParams): void {
        if (!params.id) {
            throw new Error("Parameter expected: id");
        }
        if (!params.sceneModel) {
            throw new Error("Parameter expected: sceneModel");
        }
        if (!params.sceneModel.built) {
            throw new Error("SceneModel must be built before adding to a Scene");
        }
        if (this.models[params.id]) {
            throw new Error(`SceneModel with this ID already added to Scene: "${params.id}"`);
        }
        if (params.sceneModel.renderer) {
            throw new Error(`SceneModel already added to another Scene`);
        }
        this.#renderer.addModel(params);
        const id = params.id;
        const sceneModel = params.sceneModel;
        this.models[id] = sceneModel;
        this.#registerObjects(sceneModel);
        this.onModelAdded.dispatch(this, sceneModel);
        this.#onModelDestroys[id] = sceneModel.onDestroyed.one(() => {
            delete this.models[id];
            this.#deregisterObjects(sceneModel);
            this.onModelRemoved.dispatch(this, sceneModel);
        });
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
     * Removes a {@link @xeokit/core/components!SceneModel | SceneModel} from this Scene.
     *
     * @param id The ID against which the SceneModel was registered under when it was
     * previously added with {@link addModel}.
     */
    removeModel(id: string) {
        if (this.models[id]) {
            return;
        }
        this.#renderer.removeModel(id);
        const sceneModel = this.models[id];
        delete this.models[id];
        this.#deregisterObjects(sceneModel);
        sceneModel.onDestroyed.unsubscribe(this.#onModelDestroys[id]);
    }

    /**
     * Removes all {@link @xeokit/core/components!SceneModel | Models} currently in this Scene.
     */
    removeAllModels() {
        for (let id in this.models) {
            this.removeModel(id);
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
        this.onModelAdded.clear();
        this.onModelRemoved.clear();
        for (let id in this.models) {
            this.models[id].destroy();
        }
    }
}