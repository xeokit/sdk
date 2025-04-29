/**
 * A file in a {@link XeoConvertManifestReport  | XeoConvertManifestReport}.
 */
export interface XeoConvertManifestReportFile {

    /**
     *
     */
    filePath: string;

    /**
     *
     */
    fileFormat: string;

    /**
     *
     */
    fileFormatVersion: string,

    /**
     *
     */
    fileDataSizeBytes: number;

    /**
     *
     */
    fileDataType: string;

    /**
     *
     */
    options: { [key: string]: any };

    /**
     *
     */
    aabb: number[];
}
