/**
 * Data type from which a {@link DataModel} is created.
 */
import {PropertySetParams} from "./PropertySetParams";
import {DataObjectParams} from "./DataObjectParams";

/**
 * Parameters for creating a {@link DataModel} with {@link Data.createModel}.
 */
export interface DataModelParams {

    /**
     * Unique ID of the DataModel.
     */
    id?: string,

    /**
     * The project ID, if available.
     */
    projectId?: string | number,

    /**
     * The model ID, if available.
     */
    revisionId?: string | number,

    /**
     * The author, if available.
     */
    author?: string,

    /**
     * The data the model was created, if available.
     */
    createdAt?: string,

    /**
     * The application that created the model, if known.
     */
    creatingApplication?: string,

    /**
     * The model schema version, if available.
     */
    schema?: string,

    /**
     * The {@link PropertySet}s in the DataModel.
     */
    propertySets?: PropertySetParams[],

    /**
     * The {@link DataObject}s in the DataModel.
     */
    objects?: DataObjectParams[]
}