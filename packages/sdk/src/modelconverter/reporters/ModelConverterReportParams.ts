import { ModelConverter, ModelConverterResult } from "../index";

/**
 * Represents the parameters required for generating a model converter report.
 *
 * This interface encapsulates the model converter instance and the result of the conversion process.
 * These parameters are used in report generation functions to provide insights into the conversion process.
 */
export interface ModelConverterReportParams {

    /**
     * The result of the model conversion, containing the details of the inputs, outputs, and other statistics
     * generated during the conversion. This object provides access to all relevant data to report on the conversion.
     */
    modelConverterResult: ModelConverterResult;
}
