import * as math from '../math/index';

import {Component} from '../Component';
import {Viewer} from "../Viewer";
import {SceneObject} from "./SceneObject";
import {SceneModel} from "./SceneModel";
import {createUUID} from "../utils/index";
import {SceneModelParams} from "./SceneModelParams";
import {Tiles} from "./Tiles";

/**
 * Contains geometry and materials for models.
 *
 * * Located at {@link Viewer.scene}
 * * Contains {@link SceneModel}s and {@link SceneObject}s
 *
 *
 */
export class Scene extends Component {

    /**
     * The {@link Viewer} this Scene belongs to.
     */
    declare readonly viewer: Viewer;

    /**
     * The {@link Tiles} in this Scene.
     */
    readonly tiles: Tiles;

    /**
     * The {@link SceneModel}s in this Scene.
     */
    readonly models: { [key: string]: SceneModel };

    /**
     * The {@link SceneObject}s in this Scene.
     */
    readonly objects: { [key: string]: SceneObject };

    #center: Float64Array;
    #aabb: Float64Array;
    
    #aabbDirty: boolean;

    /**
     * @private
     */
    constructor(viewer: Viewer, params = {}) {

        super(null, params);

        this.tiles = new Tiles(this);
        this.viewer = viewer;
        this.models = {};
        this.objects = {};

        this.#center = math.vec3();
        this.#aabb = math.boundaries.AABB3();
        this.#aabbDirty = true;
    }

    /**
     * Gets the World-space 3D center of this Scene.
     */
    get center(): Float64Array {
        if (this.#aabbDirty) {
            const aabb = this.aabb; // Lazy-build AABB
            this.#center[0] = (aabb[0] + aabb[3]) / 2;
            this.#center[1] = (aabb[1] + aabb[4]) / 2;
            this.#center[2] = (aabb[2] + aabb[5]) / 2;
        }
        return this.#center;
    }

    /**
     * Gets the World-space axis-aligned 3D boundary (AABB) of this Scene.
     *
     * The AABB encompases the boundaries of all {@link SceneModel} s currently in {@link Scene.models}, and  is
     * represented by a six-element Float64Array containing the min/max extents of the axis-aligned volume, ie. ````[xmin, ymin,zmin,xmax,ymax, zmax]````.
     *
     * When the Scene has no content, the boundary will be an inverted shape, ie. ````[-100,-100,-100,100,100,100]````.
     */
    get aabb() : Float64Array {
        if (this.#aabbDirty) {
            let xmin = math.MAX_DOUBLE;
            let ymin = math.MAX_DOUBLE;
            let zmin = math.MAX_DOUBLE;
            let xmax = math.MIN_DOUBLE;
            let ymax = math.MIN_DOUBLE;
            let zmax = math.MIN_DOUBLE;
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
     * Creates a new {@link SceneModel} within this Scene.
     *
     * The SceneModel represents a new model within the Scene and provides an interface through which
     * we can then build geometry and materials within it.
     *
     * When we've finished building our SceneModel, we then call {@link SceneModel.finalize}, which causes it to
     * immediately begin rendering within all the {@link View}s we created previously with {@link Viewer.createView}.
     *
     * As that happens, each {@link View} automatically gets a {@link ViewObject} for each of the SceneModel's {@link SceneObject}s, to
     * independently represent that SceneObject's visual state in that View.
     *
     * When we've finished with the SceneModel, we destroy it using {@link SceneModel.destroy}. That will automatically remove its
     * ViewObjects from all our existing Views.
     *
     * @param params SceneModel configuration
     * @seealso {@link Data.createModel}
     */
    createModel(params: SceneModelParams): SceneModel {
        this.log(`Creating SceneModel : ${params.id}`);
        if (this.viewer.viewList.length === 0) {
            throw "Please create a View with Viewer.createView() before creating a SceneModel";
        }
        params.id = params.id || createUUID();
        if (this.models[params.id]) {
            this.error(`SceneModel with this ID already exists, or is under construction: "${params.id}"`);
            return;
        }
        const sceneModel = this.viewer.renderer.createModel(params);
        this.models[sceneModel.id] = sceneModel;
        sceneModel.events.on("finalized", (finalizedSceneModel) => {
            this.#registerSceneObjects(finalizedSceneModel);
            this.events.fire("sceneModelCreated", finalizedSceneModel);
            this.log(`SceneModel created: ${finalizedSceneModel.id}`);
        });
        sceneModel.events.on("destroyed", (destroyedSceneModel) => {
            delete this.models[destroyedSceneModel.id];
            this.#deregisterSceneObjects(destroyedSceneModel);
            this.events.fire("sceneModelDestroyed", destroyedSceneModel);
        });
        return sceneModel;
    }

    /**
     * Destroys all {@link SceneModel}s in this Scene.
     *
     * This invalidates all SceneModels created previously with {@link Scene.createModel}.
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
            this.events.fire("aabb", true);
        }
    }

    #registerSceneObjects(sceneModel: SceneModel) {
        const objects = sceneModel.objects;
        for (let id in objects) {
            const sceneObject = objects[id];
            this.objects[sceneObject.id] = sceneObject;
        }
        this.#aabbDirty = true;
    }

    #deregisterSceneObjects(sceneModel: SceneModel) {
        const objects = sceneModel.objects;
        for (let id in objects) {
            const sceneObject = objects[id];
            delete this.objects[sceneObject.id];
        }
        this.#aabbDirty = true;
    }

    /**
     * @private
     */
    destroy() {
        for (const modelId in this.models) {
            if (this.models.hasOwnProperty(modelId)) {
                const sceneModel = this.models[modelId];
                sceneModel.destroy();
            }
        }
        super.destroy();
    }
}


