import type { ModelConverter } from "../../modelconverter";
import { type ModelConverterResult } from "../../modelconverter";
import type { XeoConvertStatsReport } from "./stats";

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
