import {PropertySet} from "./PropertySet";
import {DataModel} from "./DataModel";
import {DataObjectParams} from "./DataObjectParams";
import {Relation} from "./Relation";

/**
 *  Semantic data about an object within a {@link Viewer}.
 *
 *  ## Overview
 *
 *  * Belongs to a {@link DataModel}
 *  * Corresponds to a {@link SceneObject} when {@link DataObject.id} matches the {@link SceneObject.id}
 *  * Stored by {@link SceneObject.id} in {@link DataModel.objects} and {@link Data.objects}
 *  * Created with {@link DataModel.createObject} or {@link DataObject.createObject}
 */
class DataObject {

    /**
     * Model metadata.
     */
    public readonly model: DataModel;

    /**
     * Globally-unique ID.
     *
     * DataObject instances are registered by this ID in {@link Data.objects} and {@link DataModel.objects}.
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
        model: DataModel,
        id: string,
        originalSystemId: string,
        name: string,
        type: string,
        parent?: DataObject,
        propertySets?: PropertySet[]) {

        this.model = model;
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
    createObject(cfg: DataObjectParams): DataObject {
        cfg.parentId = this.id;
        return this.model.createObject(cfg);
    }

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
    withObjectsInSubtree(callback: (arg0: DataObject) => void): void {

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