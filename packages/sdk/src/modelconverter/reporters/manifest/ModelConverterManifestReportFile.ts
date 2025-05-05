/**
 * Represents a file included in a {@link ModelConverterManifestReport | ModelConverterManifestReport}.
 *
 * This file contains metadata and diagnostic information about a specific file in the model
 * conversion process. It includes details like file path, format, size, and options used during processing.
 */
export interface ModelConverterManifestReportFile {

    /**
     * The absolute or relative path to the file in the manifest.
     */
    filePath: string;

    /**
     * The format of the file (e.g., "glTF", "IFC", "DotBIM").
     */
    fileFormat: string;

    /**
     * The version of the file format used.
     */
    fileFormatVersion: string;

    /**
     * The raw size of the file data in bytes.
     */
    fileDataSizeBytes: number;

    /**
     * A descriptor indicating the type of data contained in the file
     * (e.g., "arraybuffer", "text", "json").
     */
    fileDataType: string;

    /**
     * A map of configuration options or parameters used during processing this file.
     *
     * Keys are typically CLI flags or other processing parameters, and values may vary in type.
     */
    options: { [key: string]: any };

    /**
     * The axis-aligned bounding box (AABB) for the file, represented as an array of numbers
     * indicating the coordinates of the bounding box.
     */
    aabb: number[];
}
