import {ModelEncoder} from "./ModelEncoder";

/**
 * Constructor paramsters for a {@link ModelExporter}.
 */
export interface ModelExporterParams {

    /**
     * Encoders for exported schema versions.
     */
    encoders: {
        [key: string]: ModelEncoder;
    };

    /**
     * The default exported schema version.
     */
    defaultVersion: string;

    /**
     * Data type of the exported file data.
     */
    fileDataType: string;
}
