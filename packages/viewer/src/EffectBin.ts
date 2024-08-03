import {Component, EventEmitter} from "@xeokit/core";
import {ViewObject} from "./ViewObject";
import type {Viewer} from "./Viewer";
import {Effect} from "./Effect";

/**
 * TODO
 */
export class EffectBin extends Component {

    readonly effect: Effect;

    #existingObjects: { [key: string]: ViewObject };
    #objects: { [key: string]: ViewObject };
    #numObjects: number;
    #objectIds: string[] | null;
    #viewer: Viewer;
    #onTick: () => void;

    readonly onObjectUpdated: EventEmitter<EffectBin, ViewObject>;

    /**
     * @private
     */
    constructor(options: {
        id: string;
        effect: Effect;
        viewer: Viewer;
        objects: { [key: string]: ViewObject };
    }) {
        super(null, options);

        this.#viewer = options.viewer;
        this.effect = options.effect;
        this.#existingObjects = options.objects;
        this.#objects = {};
        this.#numObjects = 0;
        this.#objectIds = null;
    }

    /**
     * @orivate
     */
    objectDestroyed(objectId: string) {
         if (this.#existingObjects[objectId]) {
            if (this.#objects[objectId]) {
                delete this.#objects[objectId];
                delete this.#existingObjects[objectId];
                this.#objectIds = null;
            }
        }
    }

    /**
     * @orivate
     */
    objectUpdated(
        viewObject: ViewObject,
        applied: boolean,
        notify: boolean = true
    ) {
        if (applied) {
            this.#objects[viewObject.id] = viewObject;
            this.#numObjects++;
        } else {
            delete this.#objects[viewObject.id];
            this.#numObjects--;
        }
        this.#objectIds = null; // Lazy regenerate
        if (notify) {
            this.onObjectUpdated.dispatch(this, viewObject);
        }
    }

    /**
     * Gets the number of ViewObjects this effect is applied to.
     */
    get numObjects(): number {
        return this.#numObjects;
    }

    /**
     * Gets the IDs of the ViewObjects this effect is applied to.
     */
    get objectIds(): string[] {
        if (!this.#objectIds) {
            this.#objectIds = Object.keys(this.#objects);
        }
        return this.#objectIds;
    }

    /**
     * Apply this effect to the ViewObjects with the given IDs.
     * @param objectIds
     */
    addObjects(objectIds: string[]): boolean {
        let changed = false;
        for (let objectId in objectIds) {
            const viewObject = this.#existingObjects[objectId];
            if (viewObject) {
                if (!this.#objects[objectId]) {
                    this.#objects[objectId] = viewObject;
                    changed = true;
                }
            }
        }
        if (changed) {
            this.#objectIds = null;
        }
        return changed;
    }

    /**
     * Remove this effect from the ViewObjects with the given IDs.
     * @param objectIds
     */
    removeObjects(objectIds: string[]): boolean {
        let changed = false;
        for (let objectId in objectIds) {
            const viewObject = this.#existingObjects[objectId];
            if (viewObject) {
                if (!this.#objects[objectId]) {
                    delete this.#objects[objectId];
                    changed = true;
                }
            }
        }
        if (changed) {
            this.#objectIds = null;
        }
        return changed;
    }

    /**
     * @private
     */
    destroy() {
        this.#viewer.onTick.unsubscribe(this.#onTick);
        this.onObjectUpdated.clear();
        this.#existingObjects = {};
        this.#objects = {};
        super.destroy();
    }
}
