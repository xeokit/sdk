import { XeoConvertReporter } from "../XeoConvertReporter";
import { XeoConvertStatsReport } from "./XeoConvertStatsReport";
import { XeoConvertReportParams } from "../XeoConvertReportParams";

/**
 * @private
 */
export const createXeoConvertStatsReport: XeoConvertReporter = (params: XeoConvertReportParams): XeoConvertStatsReport => {
  return params.xeoConvertStatsReport;
}
