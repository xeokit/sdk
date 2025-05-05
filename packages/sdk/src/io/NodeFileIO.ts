import { FileIO } from './FileIO';
import { promises as fs } from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { Blob as NodeBlob } from 'buffer'; // Node's Blob
import { CrossPlatformBlob } from './CrossPlatformBlob';

/**
 * A Node.js-specific implementation of the FileIO interface.
 *
 * This class supports reading and writing files from/to the filesystem,
 * as well as loading resources over HTTP(S).
 */
export class NodeFileIO implements FileIO {
    /**
     * Loads data from a given URL or local file path.
     *
     * - If the input starts with "http://" or "https://", it fetches the resource over the network.
     * - Otherwise, it reads the file from the local filesystem.
     *
     * @param url - The HTTP(S) URL or local file path to load.
     * @returns A promise that resolves to a Buffer containing the loaded data.
     * @throws An error if the fetch or file read fails.
     */
    async load(url: string): Promise<Buffer> {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
            return Buffer.from(await res.arrayBuffer());
        }

        return await fs.readFile(url);
    }

    /**
     * Saves data to the specified target path on the local filesystem.
     *
     * - Supports saving both Node.js Buffers and Blobs.
     * - Automatically creates directories if they do not exist.
     *
     * @param data - The data to save, as a Buffer or CrossPlatformBlob.
     * @param targetPath - The absolute or relative file path where data should be written.
     * @returns A promise that resolves when the file is successfully written.
     * @throws An error if the data type is unsupported or the write fails.
     */
    async save(data: Buffer | CrossPlatformBlob, targetPath: string): Promise<void> {
        const dir = path.dirname(targetPath);
        await fs.mkdir(dir, { recursive: true });

        let buffer: Buffer;

        if (data instanceof NodeBlob) {
            buffer = Buffer.from(await data.arrayBuffer());
        } else if (Buffer.isBuffer(data)) {
            buffer = data;
        } else {
            throw new Error('Unsupported data type for save()');
        }

        await fs.writeFile(targetPath, buffer);
    }
}
