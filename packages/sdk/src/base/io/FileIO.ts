import {type CrossPlatformBlob} from './CrossPlatformBlob';

/**
 * An interface for file input/output operations that can be implemented
 * for different environments such as Node.js or the browser.
 */
export interface FileIO {
  /**
   * Loads file data from a given URL or path.
   *
   * @param url - The source URL or file path to load from.
   * @returns A promise that resolves to either a Node.js Buffer or a CrossPlatformBlob,
   *          depending on the environment.
   */
  load(url: string): Promise<Buffer | CrossPlatformBlob>;

  /**
   * Saves data to a specified target location.
   *
   * @param data - The data to save, which can be a Buffer or a CrossPlatformBlob.
   * @param target - The destination path or identifier where the data should be saved.
   * @returns A promise that resolves when the save operation is complete.
   */
  save(data: Buffer | CrossPlatformBlob, target: string): Promise<void>;
}
