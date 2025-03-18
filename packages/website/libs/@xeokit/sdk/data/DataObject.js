/**
 * An object within a {@link data!DataModel | DataModel}.
 *
 * * Created with {@link data!DataModel.createObject | DataModel.createObject}
 * * Stored in {@link data!Data.objects | Data.objects}, {@link data!Data.rootObjects | Data.rootObjects}, {@link data!Data.objectsByType | Data.objectsByType}, {@link data!DataModel.objects | Data.objects}, {@link data!DataModel.rootObjects | Data.rootObjects}
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export class DataObject {
    /**
     *  {@link data!Data | Data} that contains this DataObject.
     */
    data;
    /**
     * {@link data!DataModel | DataModels} that share this DataObject.
     */
    models;
    /**
     * Globally-unique ID.
     *
     * DataObjects are stored by ID in {@link data!Data.objects | Data.objects}, {@link data!Data.rootObjects | Data.rootObjects}, {@link data!Data.objectsByType | Data.objectsByType} and {@link data!DataModel.rootObjects | Data.rootObjects}.
     */
    id;
    /**
     * ID of this DataObject within the originating system, is any. Defaults to the value of
     * {@link data!DataObject.id | DataObject.id}.
     */
    originalSystemId;
    /**
     * Human-readable name.
     */
    name;
    /**
     * Human-readable description.
     */
    description;
    /**
     * DataObject's type.
     */
    type;
    /**
     *{@link data!PropertySet | PropertySets} referenced by this DataObject.
     */
    propertySets;
    /**
     * The {@link data!Relationship | Relations} in which this DataObject is the {@link data!Relationship.relatingObject | Relationship.relatingObject} participant.
     *
     * Each DataObject is mapped here by {@link data!Relationship.type | Relationship.type} and sub-mapped by {@link data!Relationship.relatingObject | Relationship.relatingObject}.
     */
    relating;
    /**
     * The {@link data!Relationship | Relationships} in which this DataObject is the {@link data!Relationship.relatedObject | Relationship.relatedObject} participant.
     *
     * Each DataObject is mapped here by {@link data!Relationship.type | Relationship.type} and sub-mapped by {@link data!Relationship.relatedObject | Relationship.relatedObject}.
     */
    related;
    /**
     * @private
     */
    constructor(data, model, id, originalSystemId, name, description, type, propertySets) {
        this.data = data;
        this.models = [model];
        this.id = id;
        this.originalSystemId = originalSystemId;
        this.name = name;
        this.description = description;
        this.type = type;
        this.propertySets = propertySets || [];
        this.related = {};
        this.relating = {};
    }
}
//# sourceMappingURL=DataObject.js.map