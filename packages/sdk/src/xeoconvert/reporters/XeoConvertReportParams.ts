import { ModelConverter, ModelConverterResult } from "../../modelconverter";
import { XeoConvertStatsReport } from "./stats";

/**
 *
 */
export interface XeoConvertReportParams {

  /**
     *
     */
  modelConverter: ModelConverter;
  modelConverterResult: ModelConverterResult;
  xeoConvertStatsReport: XeoConvertStatsReport;
}
