
import {DataModelContentParams} from "./DataModelContentParams";

/**
 * Parameters for creating a {@link @xeokit/data!DataModel | DataModel} with {@link @xeokit/data!Data.createModel | Data.createModel}.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export interface DataModelParams extends DataModelContentParams {

    /**
     * Unique ID of the DataModel.
     *
     * The DataModel is stored in {@link @xeokit/data!Data.models | Data.models} under this ID.
     */
    id: string;

    /**
     * The project ID, if available.
     */
    projectId?: string | number;

    /**
     * The data model model ID, if available.
     */
    revisionId?: string | number;

    /**
     * The data model author, if available.
     */
    author?: string;

    /**
     * The data the model was created, if available.
     */
    createdAt?: string;

    /**
     * The application that created the data model, if known.
     */
    creatingApplication?: string;

    /**
     * The data model schema version, if available.
     */
    schema?: string;
}
