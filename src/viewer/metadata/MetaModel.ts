import {PropertySet} from "./PropertySet";
import {MetaScene} from "./MetaScene";
import {MetaObject} from "./MetaObject";
import {MetaModelData} from "./MetaModelData";

/**
 *  Metadata about a model within a {@link Viewer}.
 *
 * ## Overview
 *
 *  * Belongs to a {@link MetaScene}
 *  * Created with {@link MetaScene.createMetaModel}
 *  * Registered by {@link MetaModel.id} in {@link MetaScene.metaModels}
 *  * Contains {@link MetaObject}s and {@link PropertySet}s
 */
class MetaModel {

    /**
     * The MetaScene to which this MetaModel belongs.
     */
    public readonly metaScene: MetaScene;

    /**
     * Unique ID of this MetaModel within its MetaScene.
     *
     * MetaModels are registered by ID in {@link MetaScene.metaModels}.
     */
    public readonly id: string;

    /**
     * The project ID.
     */
    public readonly projectId?: string | number;

    /**
     * The revision ID, if available.
     *
     * Will be undefined if not available.
     */
    public readonly revisionId?: string | number;

    /**
     * The model author, if available.
     *
     * Will be undefined if not available.
     */
    public readonly author?: string;

    /**
     * The date the model was created, if available.
     *
     * Will be undefined if not available.
     */
    public readonly createdAt?: string;

    /**
     * The application that created the model, if available.
     *
     * Will be undefined if not available.
     */
    public readonly creatingApplication?: string;

    /**
     * The model schema version, if available.
     *
     * Will be undefined if not available.
     */
    public readonly schema?: string;

    /**
     * The {@link PropertySet}s in this MetaModel, mapped to {@link PropertySet.id}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * The root {@link MetaObject} in this MetaModel's composition hierarchy.
     */
    public rootMetaObject: MetaObject;

    /**
     * The {@link MetaObject}s in this MetaModel, mapped to {@link MetaObject.id}.
     */
    public metaObjects: { [key: string]: MetaObject };

    /**
     * The {@link MetaObject}s in this MetaModel, mapped to {@link MetaObject.type}, sub-mapped to {@link MetaObject.id}.
     */
    public metaObjectsByType: { [key: string]: { [key: string]: MetaObject } };

    /**
     * The count of each type of {@link MetaObject} in this MetaModel, mapped to {@link MetaObject.type}.
     */
    public typeCounts: { [key: string]: number };

    #destroyed: boolean;

    /**
     * @private
     */
    constructor(
        metaScene: MetaScene,
        id: string,
        cfg: MetaModelData,
        options?: {
            includeTypes?: string[],
            excludeTypes?: string[],
            globalizeObjectIds?: boolean
        }) {

        this.metaScene = metaScene;

        this.id = id;
        this.projectId = cfg.projectId || "";
        this.revisionId = cfg.revisionId || "";
        this.author = cfg.author || "";
        this.createdAt = cfg.createdAt || "";
        this.creatingApplication = cfg.creatingApplication || "";
        this.schema = cfg.schema || "";
        this.propertySets = {};
        this.metaObjects = {};
        this.rootMetaObject = null;
        this.#destroyed = false;

        if (cfg.propertySets) {
            for (let i = 0, len = cfg.propertySets.length; i < len; i++) {
                this.createPropertySet(cfg.propertySets[i]);
            }
        }

        if (cfg.metaObjects) {
            for (let i = 0, len = cfg.metaObjects.length; i < len; i++) {
                const metaObjectCfg = cfg.metaObjects[i];
                this.createMetaObject({
                    id: metaObjectCfg.id,
                    originalSystemId: metaObjectCfg.originalSystemId,
                    name: metaObjectCfg.name,
                    type: metaObjectCfg.type,
                    propertySetIds: metaObjectCfg.propertySetIds
                });
            }
            for (let i = 0, len = cfg.metaObjects.length; i < len; i++) {
                const metaObjectCfg = cfg.metaObjects[i];
                const metaObject = this.metaObjects[metaObjectCfg.id];
                if (metaObject) {
                    if (metaObjectCfg.parentId) {
                        const parentMetaObject = this.metaObjects[metaObjectCfg.parentId];
                        if (parentMetaObject) {
                            metaObject.parent = parentMetaObject;
                        } else {
                            this.rootMetaObject = metaObject; // FIXME
                        }
                    } else {
                        this.rootMetaObject = metaObject; // FIXME
                    }
                }
            }
        }
    }

    /**
     * Creates a PropertySet within this MetaModel.
     *
     * The PropertySet will be associated directly with the MetaModel, and not with any {@link MetaObject}s.
     *
     * @param cfg
     */
    createPropertySet(cfg: {
        id: string;
        originalSystemId?: string;
        name: string;
        type: string;
        properties?: {
            name: string,
            value: any,
            type?: string,
            valueType?: string | number,
            description?: string
        }[]
    }): PropertySet {
        if (this.#destroyed) {
            return;
        }
        const propertySet = new PropertySet(this, cfg.id, cfg.originalSystemId, cfg.name, cfg.type, cfg.properties);
        this.propertySets[cfg.id] = propertySet;
        return propertySet;
    }

    /**
     * Creates a MetaObject within this MetaModel.
     *
     * ## Usage
     *
     * ````javascript
     * myMetaModel.createMetaObject({
     *    id: "foo",
     *    name: "Foo",
     *    originalSystemId?: "foo",
     *    parentId:"bar",
     *    propertySetIds: ["baz"],
     *    type: "Default"
     * });
     ````

     @param cfg
     */
    createMetaObject(cfg: {
        id: string;
        originalSystemId?: string;
        type: string;
        name: string;
        parentId?: string,
        propertySetIds?: string[]
    }): MetaObject {
        if (this.#destroyed) {
            return;
        }
        const id = cfg.id;
        const type = cfg.type;
        let parentMetaObject;
        if (cfg.parentId) {
            parentMetaObject = this.metaObjects[cfg.parentId];
        }
        const propertySets = [];
        if (cfg.propertySetIds) {
            for (let i = 0, len = cfg.propertySetIds.length; i < len; i++) {
                const propertySetId = cfg.propertySetIds[i];
                const propertySet = this.propertySets[propertySetId];
                if (!propertySet) {
                    console.error(`PropertySet not found: "${propertySetId}"`);
                } else {
                    propertySets.push(propertySet);
                }
            }
        }
        const metaObject = new MetaObject(this, id, cfg.originalSystemId, cfg.name, cfg.type, parentMetaObject, propertySets);
        this.metaObjects[id] = metaObject;
        if (!this.metaObjectsByType[type]) {
            this.metaObjectsByType[type] = {};
        }
        this.metaObjectsByType[type][id] = metaObject;
        this.typeCounts[type] = (this.typeCounts[type] === undefined) ? 1 : this.typeCounts[type] + 1;
        return metaObject;
    }

    /**
     * Destroys this MetaModel.
     */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.metaScene.removeMetaModel(this);
        this.#destroyed = true;
    }
}


export {MetaModel};