import type {E57Document, E57Header} from "./types";
import {parseE57Header} from "./parseE57Header";
import {buildLogicalStream, physicalToLogical} from "./e57PageReader";
import {parseE57Xml} from "./parseE57Xml";

/** Header + logical stream + parsed XML for an E57 file. */
export interface E57File {
  header: E57Header;
  /** CRC-stripped logical stream — pass to `decodeCompressedVector`. */
  logical: Uint8Array;
  document: E57Document;
}

/**
 * Reads an E57 file's structure: header, logical (CRC-stripped) stream, and the
 * parsed XML document. Point data stays undecoded — call
 * {@link decodeCompressedVector} per scan so large clouds decode lazily.
 */
export function readE57(fileData: ArrayBuffer): E57File {
  const header = parseE57Header(fileData);
  const logical = buildLogicalStream(fileData, header.pageSize);
  const xmlStart = physicalToLogical(header.xmlPhysicalOffset, header.pageSize);
  const xmlEnd = xmlStart + header.xmlLogicalLength;
  if (xmlEnd > logical.length) {
    throw new Error("[readE57] XML section runs past end of file — truncated or corrupt");
  }
  const xml = new TextDecoder("utf-8").decode(logical.subarray(xmlStart, xmlEnd));
  const document = parseE57Xml(xml);
  return {header, logical, document};
}
