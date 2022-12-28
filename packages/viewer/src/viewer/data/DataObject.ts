import type {PropertySet} from "./PropertySet";
import type {DataModel} from "./DataModel";
import type {DataObjectParams} from "./DataObjectParams";

/**
 *  Semantic data about an object in a {@link DataModel}.
 *
 *  See {@link Data} for usage examples.
 *
 *  ## Summary
 *
 *  * Created with {@link DataModel.createObject}
 *  * Stored in {@link Data.objects} and {@link DataModel.objects}
 */
class DataObject {

    /**
     * Model metadata.
     */
    public models: DataModel[];

    /**
     * Globally-unique ID.
     *
     * DataObject instances are registered by this ID in {@link Data.objects} and {@link DataModel.objects}.
     */
    public readonly id: string;

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
    #parent: DataObject | null;

    /**
     * Child DataObject instances within the structure hierarchy.
     *
     * Undefined when there are no children.
     */
    public readonly objects: DataObject[];

    /**
     * @private
     */
    constructor(
        model: DataModel,
        id: string,
        name: string,
        type: string,
        propertySets?: PropertySet[]) {

        this.models = [model];
        this.id = id;
        this.name = name;
        this.type = type;
        this.propertySets = propertySets || [];
        this.parent = null;
        this.objects = [];
    }

    /**
     * Sets the parent DataObject within the structure hierarchy.
     * @param parent
     */
    set parent(parent: DataObject | null) {
        this.#parent = parent;
        if (parent) {
            delete this.models[0].data.rootObjects[this.id];
        } else {
            this.models[0].data.rootObjects[this.id] = this;
        }
        for (let i = 0, len = this.models.length; i < len; i++) {
            if (parent) {
                delete this.models[i].rootObjects[this.id];
            } else {
                this.models[i].rootObjects[this.id] = this;
            }
        }
    }

    /**
     * Gets the parent DataObject within the structure hierarchy.
     */
    get parent(): DataObject | null {
        return this.#parent;
    }

    // /**
    //  * Creates a child DataObject of this.
    //  *
    //  * Ignores {@link DataObjectParams.parentId} if given, effectively
    //  * replacing that parameter with this DataObject's {@link DataObject.id}, in order to
    //  * create the new DataObject as a child.
    //  *
    //  * This will cause every DataModel that contains this DataObject to also get the new child DataObject.
    //  *
    //  * @param dataObjectCfg
    //  */
    // createObject(dataObjectCfg: DataObjectParams): DataObject | null {
    //     dataObjectCfg.parentId = this.id;
    //     let dataObject: DataObject | null = null;
    //     for (let i = 0, len = this.models.length; i < len; i++) {
    //         dataObject = this.models[i].createObject(dataObjectCfg); // Only one instance created
    //     }
    //     return dataObject;
    // }

    /**
     * Gets the {@link DataObject.id}s of the {@link DataObject}s within the subtree.
     */
    getObjectIdsInSubtree(): (string | number)[] {
        const objectIds: (string | number)[] = [];

        function visit(dataObject: DataObject) {
            if (!dataObject) {
                return;
            }
            objectIds.push(dataObject.id);
            const objects = dataObject.objects;
            if (objects) {
                for (let i = 0, len = objects.length; i < len; i++) {
                    visit(objects[i]);
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
    withObjectsInSubtree(callback: (arg0: DataObject) => void): void {

        function visit(dataObject: DataObject) {
            if (!dataObject) {
                return;
            }
            callback(dataObject);
            const children = dataObject.objects;
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
            const objects = dataObject.objects;
            if (objects) {
                for (let i = 0, len = objects.length; i < len; i++) {
                    visit(objects[i]);
                }
            }
        }

        visit(this);
        return objectIds;
    }
}

export {DataObject};