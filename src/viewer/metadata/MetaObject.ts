import {PropertySet} from "./PropertySet";
import {MetaModel} from "./MetaModel";

/**
 *  Metadata about an object within a {@link Viewer}.
 *
 *  ## Overview
 *
 *  * Belongs to a {@link MetaModel}
 *  * Registered by {@link MetaObject.id} in {@link MetaModel.metaObjects} and {@link MetaScene.metaObjects}
 *  * Can be connected into parent-child hierarchies
 *  * Leaf MetaObjects often have corresponding {@link SceneObject}s and {@link ViewObject}s
 *  * Created with {@link MetaModel.createMetaObject} or {@link MetaObject.createMetaObject}
 */
class MetaObject {

    /**
     * Model metadata.
     */
    public readonly metaModel: MetaModel;

    /**
     * Globally-unique ID.
     *
     * MetaObject instances are registered by this ID in {@link MetaScene.metaObjects} and {@link MetaModel.metaObjects}.
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
     * MetaObject's type.
     */
    public readonly type: string;

    /**
     * Optional {@link PropertySet}s used by this MetaObject.
     */
    public readonly propertySets?: PropertySet[];

    /**
     * The parent MetaObject within the structure hierarchy.
     *
     * Undefined when this is the root of its structure.
     */
    public parent?: MetaObject;

    /**
     * Child ObjectMeta instances within the structure hierarchy.
     *
     * Undefined when there are no children.
     */
    public readonly children: MetaObject[];

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
        metaModel: MetaModel,
        id: string,
        originalSystemId: string,
        name: string,
        type: string,
        parent?: MetaObject,
        propertySets?: PropertySet[]) {

        this.metaModel = metaModel;
        this.id = id;
        this.originalSystemId = originalSystemId;
        this.name = name;
        this.type = type;
        this.propertySets = propertySets || [];
        this.parent = parent;
        this.children = [];
    }

    /**
     * Creates a child MetaObject.
     *
     * @param cfg - MetaObject configs
     * @param cfg.id - ID for the MetaObject, unique within the {@link MetaScene}
     * @param cfg.type - Type for the MetaObject
     * @param cfg.name - Human-readable name of the MetaObject
     * @param cfg.parentId - ID of optional parent MetaObject
     * @param cfg.propertySetIds - ID of one or more {@link PropertySet}s in {@link MetaModel.propertySets}
     */
    createMetaObject(cfg: {
        id: string;
        originalSystemId?: string;
        type: string;
        name: string;
        parentId?: string,
        propertySetIds?: string[]
    }): MetaObject {
        cfg.parentId = this.id;
        return this.metaModel.createMetaObject(cfg);
    }

    /**
     * Gets the {@link MetaObject.id}s of the {@link MetaObject}s within the subtree.
     */
    getMetaObjectIdsInSubtree():(string|number)[] {
        const objectIds: (string | number)[] = [];

        function visit(metaObject: MetaObject) {
            if (!metaObject) {
                return;
            }
            objectIds.push(metaObject.id);
            const children = metaObject.children;
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
     * Iterates over the {@link MetaObject}s within the subtree.
     *
     * @param callback Callback fired at each {@link MetaObject}.
     */
    withMetaObjectsInSubtree(callback: (arg0: MetaObject) => void) :void{

        function visit(metaObject: MetaObject) {
            if (!metaObject) {
                return;
            }
            callback(metaObject);
            const children = metaObject.children;
            if (children) {
                for (var i = 0, len = children.length; i < len; i++) {
                    visit(children[i]);
                }
            }
        }

        visit(this);
    }

    /**
     * Gets the {@link MetaObject.id}s of the {@link MetaObject}s within the subtree that have the given {@link MetaObject.type}s.
     *
     * @param {String[]} types {@link MetaObject.type} values.
     * @returns {String[]} Array of {@link MetaObject.id}s.
     */
    getMetaObjectIdsInSubtreeByType(types: string[]): (string | number)[] {
        const mask: { [key: string]: any; } = {};
        for (let i = 0, len = types.length; i < len; i++) {
            mask[types[i]] = types[i];
        }
        const objectIds: (string | number)[] = [];

        function visit(metaObject: MetaObject) {
            if (!metaObject) {
                return;
            }
            if (mask[metaObject.type]) {
                objectIds.push(metaObject.id);
            }
            const children = metaObject.children;
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

export {MetaObject};