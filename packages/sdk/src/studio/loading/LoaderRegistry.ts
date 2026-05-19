import type {SceneModel} from "../../model/scene";
import type {DataModel} from "../../model/data";
import type {SDKResult} from "../../base/core";

/**
 * How a format's file data should be fetched off the network.
 */
export type FormatFetchKind = "arrayBuffer" | "text" | "json";

/**
 * Inputs handed to a {@link FormatDescriptor.load} implementation.
 *
 * The registry resolves which models the format needs via
 * {@link FormatDescriptor.needsScene} / {@link FormatDescriptor.needsData}
 * and supplies only those — descriptors do not create models themselves.
 */
export interface LoaderInput {
  fileData: any;
  sceneModel?: SceneModel;
  dataModel?: DataModel;
}

/**
 * Pure-format intrinsics held in the registry. Carries nothing about
 * filesystem layout or filename conventions — those live in the
 * {@link ModelLocator} owned by Studio.
 */
export interface FormatDescriptor {
  fetch: FormatFetchKind;
  needsScene: boolean;
  needsData: boolean;
  load: (input: LoaderInput, options: any) => Promise<SDKResult<any> | any>;
}

/**
 * Map of format key → descriptor. Lets Studio dispatch
 * {@link Studio.loadModel} without a hardcoded switch and without
 * statically importing every loader.
 */
export class LoaderRegistry {

  private readonly formats = new Map<string, FormatDescriptor>();

  register(format: string, descriptor: FormatDescriptor): void {
    this.formats.set(format, descriptor);
  }

  unregister(format: string): void {
    this.formats.delete(format);
  }

  get(format: string): FormatDescriptor | undefined {
    return this.formats.get(format);
  }

  has(format: string): boolean {
    return this.formats.has(format);
  }

  formatKeys(): string[] {
    return Array.from(this.formats.keys());
  }
}
