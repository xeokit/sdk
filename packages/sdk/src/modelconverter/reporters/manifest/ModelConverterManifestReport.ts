import {ModelConverterManifestReportFile} from "./ModelConverterManifestReportFile";

/**
 * Defines a manifest report created by `xeoconvert` with the `--manifest-report` option.
 */
export interface ModelConverterManifestReport {

    /**
     * Information on each file in the manifest report.
     */
    files: {
        [key: string]: ModelConverterManifestReportFile;
    }
}
