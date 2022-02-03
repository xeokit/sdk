import {MetaModel} from "./MetaModel";
import {MetaObject} from "./MetaObject";
import {PropertySet} from "./PropertySet";
import {Events} from "../Events";
import {Viewer} from "../Viewer";
import {MetaModelData} from "./MetaModelData";

/**
 * Provides metadata about the models and objects within a {@link Viewer}.
 *
 * ## Overview
 *
 * * Located at {@link Viewer.metaScene}
 * * Contains {@link MetaModel}s to classify the {@link SceneModel}s in the Viewer's {@link Scene}
 * * Contains hierarchies of {@link MetaObject}s to classify the {@link SceneObject}s in the Scene
 * * Provides methods to build its MetaModels and MetaObjects
 * * Provides methods to iterate and query MetaObjects
 */
class MetaScene {

    /**
     * The {@link Viewer} to which this MetaScene belongs.
     *
     * The MetaScene is located at {@link Viewer.metaScenes}.
     */
    public readonly viewer: Viewer;

    /**
     * Manages events on this MetaScene.
     */
    public readonly events: Events;

    /**
     * The {@link MetaModel}s belonging to this MetaScene, each keyed to its {@link MetaModel.id}.
     */
    public readonly metaModels: { [key: string]: MetaModel };

    /**
     * The {@link PropertySet}s belonging to this MetaScene, each keyed to its {@link PropertySet.id}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * The {@link MetaObject}s belonging to this MetaScene, each keyed to its {@link MetaObject.id}.
     */
    public readonly metaObjects: { [key: string]: MetaObject };

    /**
     * The {@link MetaObject}s belonging to this MetaScene, each map keyed to {@link MetaObject.type}, containing {@link MetaObject}s keyed to {@link MetaObject.id}.
     */
    public readonly metaObjectsByType: { [key: string]: { [key: string]: MetaObject } };

    /**
     * Tracks number of {@link MetaObject}s of each type.
     */
    private readonly typeCounts: { [key: string]: number };

    /**
     * @private
     */
    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.metaModels = {};
        this.propertySets = {};
        this.metaObjects = {};
        this.metaObjectsByType = {};
        this.typeCounts = {};
    }

    /**
     * Creates a {@link MetaModel} in this MetaScene.
     *
     * @param id ID for the new {@link MetaModel}, which will have {@link MetaModel.id} set to this value.
     * @param  metaModelCfg Data for the {@link MetaModel}.
     * @param [options] Options for creating the {@link MetaModel}.
     * @param [options.includeTypes] When provided, only create {@link MetaObject}s with types in this list.
     * @param  [options.excludeTypes] When provided, never create {@link MetaObject}s with types in this list.
     * @param [options.globalizeObjectIds=false] Whether to globalize each {@link MetaObject.id}. Set this ````true```` when you need to load multiple instances of the same meta model, to avoid ID clashes between the meta objects in the different instances.
     * @returns The new MetaModel.
     */
    createMetaModel(
        id: string,
        metaModelCfg: MetaModelData,
        options?: {
            includeTypes?: string[],
            excludeTypes?: string[],
            globalizeObjectIds?: boolean
        }
    ): MetaModel {
        const metaModel = new MetaModel(this, id, metaModelCfg, options);
        this.metaModels[id] = metaModel;
        this.events.fire("metaModelCreated", id);
        return metaModel;
    }

    /**
     * @private
     */
    removeMetaModel(metaModel: MetaModel) {
        const metaObjects = this.metaObjects;
        const metaObjectsByType = this.metaObjectsByType;
        let visit = (metaObject: MetaObject) => {
            delete metaObjects[metaObject.id];
            const types = metaObjectsByType[metaObject.type];
            if (types && types[metaObject.id]) {
                delete types[metaObject.id];
                if (--this.typeCounts[metaObject.type] === 0) {
                    delete this.typeCounts[metaObject.type];
                    delete metaObjectsByType[metaObject.type];
                }
            }
            const children = metaObject.children;
            if (children) {
                for (let i = 0, len = children.length; i < len; i++) {
                    const childMetaObject = children[i];
                    visit(childMetaObject);
                }
            }
        };
        visit(metaModel.rootMetaObject);
        for (let propertySetId in metaModel.propertySets) {
            if (metaModel.propertySets.hasOwnProperty(propertySetId)) {
                delete this.propertySets[propertySetId];
            }
        }
        delete this.metaModels[metaModel.id];
        this.events.fire("metaModelDestroyed", metaModel.id);
    }

    /**
     * Gets the {@link MetaObject.id}s of the {@link MetaObject}s that have the given {@link MetaObject.type}.
     *
     * @param type The type.
     * @returns Array of {@link MetaObject.id}s.
     */
    getMetaObjectIdsByType(type: string) {
        const metaObjects = this.metaObjectsByType[type];
        return metaObjects ? Object.keys(metaObjects) : [];
    }

    /**
     * Gets the {@link MetaObject.id}s of the {@link MetaObject}s within the given subtree.
     *
     * @param id  ID of the root {@link MetaObject} of the given subtree.
     * @param  [includeTypes] Optional list of types to include.
     * @param  [excludeTypes] Optional list of types to exclude.
     * @returns  Array of {@link MetaObject.id}s.
     */
    getMetaObjectIdsInSubtree(id: string, includeTypes: string[], excludeTypes: string[]): string[] {

        const list: string[] = [];
        const metaObject = this.metaObjects[id];
        const includeMask = (includeTypes && includeTypes.length > 0) ? arrayToMap(includeTypes) : null;
        const excludeMask = (excludeTypes && excludeTypes.length > 0) ? arrayToMap(excludeTypes) : null;

        function visit(metaObject: MetaObject) {
            if (!metaObject) {
                return;
            }
            let include = true;
            // @ts-ignore
            if (excludeMask && excludeMask[metaObject.type]) {
                include = false;
            } else { // @ts-ignore
                if (includeMask && (!includeMask[metaObject.type])) {
                    include = false;
                }
            }
            if (include) {
                list.push(metaObject.id);
            }
            const children = metaObject.children;
            if (children) {
                for (let i = 0, len = children.length; i < len; i++) {
                    visit(children[i]);
                }
            }
        }

        visit(metaObject);
        return list;
    }

    /**
     * Iterates over the {@link MetaObject}s within the subtree.
     *
     * @param id ID of root {@link MetaObject}.
     * @param callback Callback fired at each {@link MetaObject}.
     */
    withMetaObjectsInSubtree(id: string, callback: (arg0: MetaObject) => void) {
        const metaObject = this.metaObjects[id];
        if (!metaObject) {
            return;
        }
        metaObject.withMetaObjectsInSubtree(callback);
    }
}

function arrayToMap(array: any[]): { [key: string]: any } {
    const map: { [key: string]: any } = {};
    for (let i = 0, len = array.length; i < len; i++) {
        map[array[i]] = true;
    }
    return map;
}

export {MetaScene};