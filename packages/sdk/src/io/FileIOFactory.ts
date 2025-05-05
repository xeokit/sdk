import { type FileIO } from './FileIO';
import { NodeFileIO } from './NodeFileIO';
import { BrowserFileIO } from './BrowserFileIO';

/**
 * Creates a platform-specific implementation of the FileIO interface.
 *
 * This function detects the current runtime environment (Node.js or browser)
 * and returns the appropriate FileIO implementation.
 *
 * @returns An instance of FileIO suitable for the current platform.
 */
export function createFileIO(): FileIO {
    const isNode = typeof process !== 'undefined' && !!process.versions?.node;
    return isNode ? new NodeFileIO() : new BrowserFileIO();
}
