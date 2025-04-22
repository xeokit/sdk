import {ModelParser} from "./ModelParser";

/**
 * Constructor paramsters for a {@link ModelLoader}.
 */
export interface ModelLoaderParams {

    /**
     * Parsers for exported schema versions.
     */
    parsers: {
        [key: string]: ModelParser;
    };

    /**
     * Data type of the imported file data.
     */
    fileDataType: string;

    /**
     * Callback which attempts to get the schema version of the given file data.
     */
    getVersion: (fileData: any) => string;
}
