import { type XeoConvertManifestReportFile } from "./XeoConvertManifestReportFile";

/**
 * Defines a manifest report created by `xeoconvert --manifest-report` `.
 */
export interface XeoConvertManifestReport {

  /**
     * Information on each file in the manifest report.
     */
  files: {
    [key: string]: XeoConvertManifestReportFile;
  }
}
