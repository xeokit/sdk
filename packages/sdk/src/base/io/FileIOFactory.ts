import {type FileIO} from './FileIO';
import {BrowserFileIO} from './BrowserFileIO';

/**
 * Creates a platform-specific implementation of the FileIO interface.
 *
 * Currently browser-only: returns a {@link BrowserFileIO}. A Node
 * implementation hasn't been ported yet — calling this in Node
 * throws so the failure is loud rather than silent.
 *
 * @returns An instance of FileIO suitable for the current platform.
 * @throws Error if called in a Node runtime.
 */
export function createFileIO(): FileIO {
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  if (isNode) {
    throw new Error(
      "[createFileIO] Node FileIO is not implemented. Browser only — " +
      "use `new BrowserFileIO()` directly, or supply your own FileIO impl.",
    );
  }
  return new BrowserFileIO();
}
