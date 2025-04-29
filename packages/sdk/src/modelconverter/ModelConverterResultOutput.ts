/**
 * Represents a single output file produced by the {@link ModelConverter.convert | ModelConverter.convert} method.
 */
export interface ModelConverterResultOutput {

    /**
     * The converted file data.
     */
    fileData: any;

    /**
     * The type of data returned in `fileData`.
     *
     * Supported values:
     * - `"json"` — a structured JavaScript object
     * - `"arraybuffer"` — raw binary data
     */
    fileDataType: string;

    /**
     *
     */
    format: string;

    /**
     * The schema version applied when generating this output.
     */
    version: string;

    /**
     * The {@link scene!SceneModel | SceneModel} used during export.
     *
     * This object is managed internally and valid only within the scope of {@link ModelConverter.convert}.
     */
    sceneModel: string;

    /**
     * The {@link data!DataModel | DataModel} used during export.
     *
     * This object is managed internally and valid only within the scope of {@link ModelConverter.convert}.
     */
    dataModel: string;

    messages: string[];

    warnings: string[];

    errors: string[];
}
