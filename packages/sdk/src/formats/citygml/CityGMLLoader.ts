import {ModelLoader} from "../ModelLoader";
import type {ModelLoadParams} from "../ModelLoadParams";
import {parse as parse_2_0} from "./versions/v2_0/parse";
import type {CityGMLLoadOptions} from "./CityGMLLoadOptions";

/**
 * Loads a CityGML file into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link formats!citygml | @xeokit/sdk/formats/citygml}.
 */
export class CityGMLLoader extends ModelLoader {

  /**
   * Constructs a CityGMLLoader.
   */
  constructor() {
    super({
      format: "CityGML",
      fileDataType: "text",
      parsers: {
        "1.0": parse_2_0,
        "2.0": parse_2_0,
        "3.0": parse_2_0
      },
      getVersion: getCityGMLVersion
    });
  }

  /**
   * Loads CityGML file data into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
   *
   * @param params - The parameters used for loading the file data.
   * @param options - Options for loading the CityGML file.
   * @returns Resolves when the file data has been successfully loaded.
   */
  load(params: ModelLoadParams, options: CityGMLLoadOptions = {}): Promise<any> {
    return super.load(params, options);
  }
}

/**
 * @private
 */
export function getCityGMLVersion(fileData: any): string {
  if (fileData?.version) {
    return `${fileData.version}`;
  }

  const namespace = getNamespace(fileData);
  if (namespace) {
    const version = versionFromText(namespace);
    if (version) {
      return version;
    }
  }

  if (typeof fileData === "string") {
    return versionFromText(fileData.slice(0, 8192)) || "2.0";
  }
  if (fileData instanceof ArrayBuffer) {
    return versionFromText(new TextDecoder().decode(fileData.slice(0, 8192))) || "2.0";
  }
  if (ArrayBuffer.isView(fileData)) {
    const bytes = new Uint8Array(fileData.buffer, fileData.byteOffset, Math.min(fileData.byteLength, 8192));
    return versionFromText(new TextDecoder().decode(bytes)) || "2.0";
  }

  return "2.0";
}

function getNamespace(fileData: any): string | undefined {
  if (fileData?.nodeType === 9) {
    return fileData.documentElement?.namespaceURI || undefined;
  }
  if (fileData?.nodeType === 1) {
    return fileData.namespaceURI || undefined;
  }
  return undefined;
}

function versionFromText(text: string): string | undefined {
  if (/citygml\/(?:[^"'\s]*\/)?3\.0/i.test(text)) {
    return "3.0";
  }
  if (/citygml\/(?:[^"'\s]*\/)?2\.0/i.test(text)) {
    return "2.0";
  }
  if (/citygml\/(?:[^"'\s]*\/)?1\.0/i.test(text)) {
    return "1.0";
  }
  return undefined;
}
