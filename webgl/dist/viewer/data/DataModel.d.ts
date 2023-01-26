import { Component } from "../Component";
import type { Data } from "./Data";
import { PropertySet } from "./PropertySet";
import { DataObject } from "./DataObject";
import type { DataModelParams } from "./DataModelParams";
import type { DataObjectParams } from "./DataObjectParams";
import type { PropertySetParams } from "./PropertySetParams";
import { EventEmitter } from "../EventEmitter";
import type { RelationshipParams } from "./RelationshipParams";
/**
 * A buildable entity-relationship semantic data model, stored in {@link Data}.
 *
 * See {@link Data} for usage examples.
 *
 * ## Summary
 *
 *  * A DataModel is a generic entity-relationship graph of {@link DataObject|DataObjects}, {@link PropertySet|PropertySets} and {@link Relationship|Relationships}
 *  * Can be used for IFC and all other schemas that are expressable as an ER graph
 *  * Created with {@link Data.createModel}
 *  * Stored in {@link Data.models}
 *
 */
declare class DataModel extends Component {
    #private;
    /**
     * The data to which this DataModel belongs.
     */
    readonly data: Data;
    /**
     * Unique ID of this DataModel.
     *
     * MetaModels are registered by ID in {@link Data.models}.
     */
    readonly id: string;
    /**
     * The project ID, if available.
     */
    readonly projectId?: string | number;
    /**
     * The revision ID, if available.
     *
     * Will be undefined if not available.
     */
    readonly revisionId?: string | number;
    /**
     * The model author, if available.
     *
     * Will be undefined if not available.
     */
    readonly author?: string;
    /**
     * The date the model was created, if available.
     *
     * Will be undefined if not available.
     */
    readonly createdAt?: string;
    /**
     * The application that created the model, if available.
     *
     * Will be undefined if not available.
     */
    readonly creatingApplication?: string;
    /**
     * The model schema version, if available.
     *
     * Will be undefined if not available.
     */
    readonly schema?: string;
    /**
     * The {@link PropertySet|PropertySets} in this DataModel, mapped to {@link PropertySet.id}.
     */
    readonly propertySets: {
        [key: string]: PropertySet;
    };
    /**
     * The root {@link DataObject} in this DataModel's composition hierarchy.
     */
    rootDataObject: null | DataObject;
    /**
     * The {@link DataObject|DataObjects} in this DataModel, mapped to {@link DataObject.id}.
     */
    objects: {
        [key: string]: DataObject;
    };
    /**
     * The root {@link DataObject|DataObjects} in this DataModel, mapped to {@link DataObject.id}.
     */
    rootObjects: {
        [key: string]: DataObject;
    };
    /**
     * The {@link DataObject|DataObjects} in this DataModel, mapped to {@link DataObject.type}, sub-mapped to {@link DataObject.id}.
     */
    objectsByType: {
        [key: string]: {
            [key: string]: DataObject;
        };
    };
    /**
     * The count of each type of {@link DataObject} in this DataModel, mapped to {@link DataObject.type}.
     */
    typeCounts: {
        [key: string]: number;
    };
    /**
     * Emits an event when the {@link DataModel} has been built.
     *
     * @event
     */
    readonly onBuilt: EventEmitter<DataModel, null>;
    /**
     * @private
     */
    constructor(data: Data, id: string, dataModelParams: DataModelParams, options?: {
        includeTypes?: string[];
        excludeTypes?: string[];
        globalizeObjectIds?: boolean;
    });
    /**
     * Creates a {@link PropertySet} within this DataModel.
     *
     * @param propertySetCfg
     */
    createPropertySet(propertySetCfg: PropertySetParams): null | PropertySet;
    /**
     * Creates a {@link DataObject} in this DataModel.
     *
     * Each DataObject has a globally-unique ID in {@link DataObject.id}, with which it's registered
     * in {@link Data.objects} and {@link DataModel.objects}.
     *
     * If {@link DataObjectParams.id} matches a DataObject that
     * already exists (ie. already created for a different DataModel), then this method will reuse that DataObject for this DataModel,
     * and will ignore any other {@link DataObjectParams} parameters that we provide. This makes the assumption that each
     * value of {@link DataObjectParams.id} is associated with a single value for {@link DataObjectParams.type}
     * and {@link DataObjectParams.name}. This aligns well with IFC, in which wewe never have two elements with the same
     * ID but different types or names.
     *
     * Each DataObject automatically gets destroyed whenever all the {@link DataModel|DataModels} that share
     * it have been destroyed.
     *
     * We can attach our DataObject as child of an existing parent DataObject. To do that, we provide the ID of the parent
     * in {@link DataObjectParams.parentId}. Following the reuse mechanism just described, the parent is allowed to be a
     * DataObject that we created in a different DataModel. If the parent does not exist yet, then our new DataObject will
     * automatically become the parent's child when the parent is created later.
     *
     * @param dataObjectParams
     */
    createObject(dataObjectParams: DataObjectParams): null | DataObject;
    /**
     * Creates a {@link Relationship} between two {@link DataObject|DataObjects}.
     *
     * @param relationshipParams
     */
    createRelationship(relationshipParams: RelationshipParams): void;
    /**
     * Builds this DataModel, readying it for use.
     */
    build(): void;
    /**
     * Destroys this DataModel.
     */
    destroy(): void;
}
export { DataModel };
