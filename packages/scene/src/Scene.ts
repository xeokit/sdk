import {Component, EventEmitter} from "@xeokit/core/components";
import {FloatArrayParam, MAX_DOUBLE, MIN_DOUBLE} from "@xeokit/math/math";
import {EventDispatcher} from "strongly-typed-events";
import {Tiles} from "@xeokit/viewer/src/Tiles";
import {SceneModel} from "./SceneModel";
import {SceneObject} from "./SceneObject";
import {SceneModelParams} from "./SceneModelParams";

/**
 * A scene representation.
 *
 * A Scene is a container of {@link SceneModel | SceneModels} and {@link SceneObject | SceneObjects}.
 */
export class Scene extends Component {

    /**
     * The {@link @xeokit/scene!SceneModel | SceneModels} belonging to this Scene, each keyed to
     * its {@link @xeokit/scene!SceneModel.id | SceneModel.id}.
     */
    public readonly models: { [key: string]: SceneModel };

    /**
     * The {@link SceneObject | SceneObjects} in this Scene, mapped to {@link SceneObject.id | SceneObject.id}.
     */
    public readonly objects: { [key: string]: SceneObject };

    /**
     * Emits an event each time a {@link SceneModel} is created in this Scene.
     *
     * @event
     */
    public readonly onModelCreated: EventEmitter<Scene, SceneModel>;

    /**
     * Emits an event each time a {@link SceneModel} is destroyed in this Scene.
     *
     * @event
     */
    public readonly onModelDestroyed: EventEmitter<Scene, SceneModel>;

    /**
     *
     */
    public readonly tiles: Tiles;

    #onModelBuilts: { [key: string]: any };
    #onModelDestroys: { [key: string]: any };
    #center: Float64Array;
    #aabbDirty: boolean;
    #aabb: Float64Array;

    /**
     * Creates a new Scene.
     *
     * See {@link "@xeokit/scene"} for usage.
     */
    constructor() {

        super(null, {});

        this.models = {};
        this.objects = {};

        this.#onModelBuilts = {};
        this.#onModelDestroys = {};
        this.onModelCreated = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
        this.onModelDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    }

    /**
     * Gets the collective World-space 3D center of all the {@link SceneModel | SceneModels} in this Scene.
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
     * Gets the collective World-space 3D [axis-aligned boundary](/docs/pages/GLOSSARY.html#aabb) of all the {@link SceneModel | SceneModels} in this Scene.
     *
     * The boundary will be of the form ````[xMin, yMin, zMin, xMax, yMax, zMax]````.
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
     * Creates a new {@link @xeokit/scene!SceneModel} in this Scene.
     *
     * Remember to call {@link SceneModel.build | SceneModel.build} when you've finished building or loading the SceneModel. That will
     * fire events via {@link Scene.onModelCreated | Scene.onModelCreated} and {@link SceneModel.onBuilt | SceneModel.onBuilt}, to
     * indicate to any subscribers that the SceneModel is built and ready for use.
     *
     * See {@link "@xeokit/scene"} for more details on usage.
     *
     * @param  sceneModelParams Creation parameters for the new {@link @xeokit/scene!SceneModel}.
     * @throws {@link Error}
     * * This Scene has already been destroyed.
     * * A SceneModel with the given ID already exists in this Scene.
     */
    createModel(sceneModelParams: SceneModelParams): SceneModel {
        if (this.destroyed) {
            throw new Error("Scene already destroyed");
        }
        const id = sceneModelParams.id;
        if (this.models[id]) {
            throw new Error(`SceneModel already created in this Scene: ${id}`);
        }
        const sceneModel = new SceneModel(this,sceneModelParams);
        this.models[id] = sceneModel;
        sceneModel.onDestroyed.one(() => { // SceneModel#destroy() called
            delete this.models[sceneModel.id];
            this.#deregisterObjects(sceneModel);
            this.onModelDestroyed.dispatch(this, sceneModel);
        });
        sceneModel.onBuilt.one(() => { // SceneModel#build() called
            this.#registerObjects(sceneModel);
            this.onModelCreated.dispatch(this, sceneModel);
        });
        return sceneModel;
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
     * Destroys all contained {@link SceneModel | SceneModels}.
     *
     * * Fires {@link Scene.onModelDestroyed | Scene.onModelDestroyed} and {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
     * for each existing SceneModel in this Scene.
     *
     * See {@link "@xeokit/scene"} for usage.
     *
     * @throws {@link Error}
     * * This Scene has already been destroyed.
     */
    clear(): void {
        if (this.destroyed) {
            throw new Error("Scene already destroyed");
        }
        for (let id in this.models) {
            this.models[id].destroy();
        }
    }

    /**
     * Destroys this Scene and all contained {@link SceneModel | SceneModels}.
     *
     * * Fires {@link Scene.onModelDestroyed | Scene.onModelDestroyed} and {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
     * for each existing SceneModels in this Data.
     * * Unsubscribes all subscribers to {@link Scene.onModelCreated | Scene.onModelCreated}, {@link Scene.onModelDestroyed | Scene.onModelDestroyed}, {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
     *
     * See {@link "@xeokit/scene"} for usage.
     *
     * @throws {@link Error}
     * * This Scene has already been destroyed.
     */
    destroy(): void {
        this.clear();
        this.onModelCreated.clear();
        this.onModelDestroyed.clear();
        super.destroy();
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
}