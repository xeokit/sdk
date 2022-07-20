import {PropertySet} from "./PropertySet";
import {DataModel} from "./DataModel";

/**
 *  Metadata about an object within a {@link Viewer}.
 *
 *  ## Overview
 *
 *  * Belongs to a {@link DataModel}
 *  * Registered by {@link DataObject.id} in {@link DataModel.dataObjects} and {@link Data.dataObjects}
 *  * Can be connected into parent-child hierarchies
 *  * Leaf dataObjects often have corresponding {@link SceneObject}s and {@link ViewObject}s
 *  * Created with {@link DataModel.createDataObject} or {@link DataObject.createDataObject}
 */
class DataObject {

    /**
     * Model metadata.
     */
    public readonly dataModel: DataModel;

    /**
     * Globally-unique ID.
     *
     * DataObject instances are registered by this ID in {@link Data.dataObjects} and {@link DataModel.dataObjects}.
     */
    public readonly id: string;

    /**
     * ID of the corresponding object within the originating system, if any.
     */
    public readonly originalSystemId?: string;

    /**
     * Human-readable name.
     */
    public readonly name: string;

    /**
     * DataObject's type.
     */
    public readonly type: string;

    /**
     * Optional {@link PropertySet}s used by this DataObject.
     */
    public readonly propertySets?: PropertySet[];

    /**
     * The parent DataObject within the structure hierarchy.
     *
     * Undefined when this is the root of its structure.
     */
    public parent?: DataObject;

    /**
     * Child ObjectMeta instances within the structure hierarchy.
     *
     * Undefined when there are no children.
     */
    public readonly children: DataObject[];

    /**
     * External application-specific metadata
     *
     * Undefined when there are is no external application-specific metadata.
     */
    public readonly external?: { [key: string]: any };

    /**
     * @private
     */
    constructor(
        dataModel: DataModel,
        id: string,
        originalSystemId: string,
        name: string,
        type: string,
        parent?: DataObject,
        propertySets?: PropertySet[]) {

        this.dataModel = dataModel;
        this.id = id;
        this.originalSystemId = originalSystemId;
        this.name = name;
        this.type = type;
        this.propertySets = propertySets || [];
        this.parent = parent;
        this.children = [];
    }

    /**
     * Creates a child DataObject.
     *
     * @param cfg - DataObject configs
     * @param cfg.id - ID for the DataObject, unique within the {@link Data}
     * @param cfg.type - Type for the DataObject
     * @param cfg.name - Human-readable name of the DataObject
     * @param cfg.parentId - ID of optional parent DataObject
     * @param cfg.propertySetIds - ID of one or more {@link PropertySet}s in {@link DataModel.propertySets}
     */
    createDataObject(cfg: {
        id: string;
        originalSystemId?: string;
        type: string;
        name: string;
        parentId?: string,
        propertySetIds?: string[]
    }): DataObject {
        cfg.parentId = this.id;
        return this.dataModel.createDataObject(cfg);
    }

    /**
     * Gets the {@link DataObject.id}s of the {@link DataObject}s within the subtree.
     */
    getDataObjectIdsInSubtree(): (string | number)[] {
        const objectIds: (string | number)[] = [];

        function visit(dataObject: DataObject) {
            if (!dataObject) {
                return;
            }
            objectIds.push(dataObject.id);
            const children = dataObject.children;
            if (children) {
                for (let i = 0, len = children.length; i < len; i++) {
                    visit(children[i]);
                }
            }
        }

        visit(this);
        return objectIds;
    }

    /**
     * Iterates over the {@link DataObject}s within the subtree.
     *
     * @param callback Callback fired at each {@link DataObject}.
     */
    withDataObjectsInSubtree(callback: (arg0: DataObject) => void): void {

        function visit(dataObject: DataObject) {
            if (!dataObject) {
                return;
            }
            callback(dataObject);
            const children = dataObject.children;
            if (children) {
                for (var i = 0, len = children.length; i < len; i++) {
                    visit(children[i]);
                }
            }
        }

        visit(this);
    }

    /**
     * Gets the {@link DataObject.id}s of the {@link DataObject}s within the subtree that have the given {@link DataObject.type}s.
     *
     * @param {String[]} types {@link DataObject.type} values.
     * @returns {String[]} Array of {@link DataObject.id}s.
     */
    getDataObjectIdsInSubtreeByType(types: string[]): (string | number)[] {
        const mask: { [key: string]: any; } = {};
        for (let i = 0, len = types.length; i < len; i++) {
            mask[types[i]] = types[i];
        }
        const objectIds: (string | number)[] = [];

        function visit(dataObject: DataObject) {
            if (!dataObject) {
                return;
            }
            if (mask[dataObject.type]) {
                objectIds.push(dataObject.id);
            }
            const children = dataObject.children;
            if (children) {
                for (let i = 0, len = children.length; i < len; i++) {
                    visit(children[i]);
                }
            }
        }

        visit(this);
        return objectIds;
    }
}

export {DataObject};