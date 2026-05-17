import {type FileIO} from './FileIO';
import {type CrossPlatformBlob} from './CrossPlatformBlob';

/**
 * A browser-specific implementation of the FileIO interface.
 *
 * This class supports loading files over HTTP(s) using `fetch`,
 * but does not support saving files due to browser limitations.
 */
export class BrowserFileIO implements FileIO {

  /**
   * Loads a file from the given URL and returns it as a CrossPlatformBlob.
   *
   * @param url - The URL of the file to load.
   * @returns A promise that resolves to a CrossPlatformBlob containing the file data.
   * @throws An error if the fetch request fails or returns a non-OK status.
   */
  async load(url: string): Promise<CrossPlatformBlob> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);
    return await res.blob();
  }

  /**
   * Not supported in the browser. Logs a warning when called.
   *
   * @param _data - The data to be saved (ignored).
   * @param _target - The target path or identifier for saving (ignored).
   * @returns A promise that resolves immediately.
   */
  async save(_data: Buffer | CrossPlatformBlob, _target: string): Promise<void> {
    console.warn('Save is not supported in the browser.');
  }
}
