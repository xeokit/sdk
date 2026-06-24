/**
 * Pure E57 reader — header, page/CRC layer, XML, and CompressedVector decode.
 *
 * SDK-free and unit-testable against raw buffers; {@link E57Loader} composes
 * these into a SceneModel. See {@link readE57} for the entry point.
 */
export * from "./types";
export * from "./parseE57Header";
export * from "./e57PageReader";
export * from "./crc32c";
export * from "./parseE57Xml";
export * from "./decodeCompressedVector";
export * from "./readE57";
