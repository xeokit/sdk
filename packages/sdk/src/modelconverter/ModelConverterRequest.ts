/**
 * Parameters required to perform a conversion using {@link ModelConverter.convert | ModelConverter.convert}.
 */
export interface ModelConverterRequest {

    /**
     * The identifier of the pipeline to use for this conversion.
     * Must match the name of a registered pipeline in the converter.
     */
    pipeline: string;

    /**
     * Input data for the selected pipeline, keyed by input name.
     * Each key should correspond to a defined pipeline input.
     */
    inputs: {
        [key: string]: any
    };


    reports?: string[];
}
