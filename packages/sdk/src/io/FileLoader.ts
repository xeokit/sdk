// // FileLoader.ts
//
// type ResponseType = 'text' | 'json' | 'arrayBuffer' | 'blob';
//
// interface LoadOptions {
//     responseType?: ResponseType;
//     headers?: Record<string>;
//     timeout?: number; // in milliseconds
//     onProgress?: (percent: number) => void; // browser only
// }
//
// export class FileLoader {
//
//     /**
//      * Load a file from a URL or file:// (Node only)
//      */
//     static async load(url: string, options: LoadOptions = {}): Promise<any> {
//         const {
//             responseType = 'text',
//             headers = {},
//             timeout,
//             onProgress,
//         } = options;
//
//         if (FileLoader.isNodeFileUrl(url)) {
//             return await FileLoader.loadNodeFile(url, <ResponseType>responseType);
//         }
//
//         const controller = timeout ? new AbortController() : undefined;
//         let timeoutId: NodeJS.Timeout | undefined;
//
//         if (timeout && controller) {
//             timeoutId = setTimeout(() => controller.abort(), timeout);
//         }
//
//         try {
//             if (typeof onProgress === 'function' && FileLoader.isBrowser()) {
//                 return await FileLoader.fetchWithProgress(url,  <ResponseType>responseType, headers, onProgress, controller);
//             } else {
//                 const response = await fetch(url, {
//                     headers,
//                     signal: controller?.signal,
//                 });
//
//                 if (!response.ok) {
//                     throw new Error(`Cannot load ${url}: ${response.status} ${response.statusText}`);
//                 }
//
//                 return await FileLoader.parseResponse(response,  <ResponseType>responseType);
//             }
//         } finally {
//             if (timeoutId) clearTimeout(<any>timeoutId);
//         }
//     }
//
//     private static async parseResponse(response: Response, responseType: ResponseType): Promise<any> {
//         switch (responseType) {
//             case 'text': return await response.text();
//             case 'json': return await response.json();
//             case 'arrayBuffer': return await response.arrayBuffer();
//             case 'blob':
//                 if (FileLoader.isNode()) throw new Error('Blob is not supported in Node.js');
//                 return await response.blob();
//             default:
//                 throw new Error(`Unsupported responseType: ${responseType}`);
//         }
//     }
//
//     private static isNodeFileUrl(url: string): boolean {
//         return FileLoader.isNode() && url.startsWith('file://');
//     }
//
//     private static isNode(): boolean {
//         // @ts-ignore
//         return typeof process !== 'undefined' &&
//             typeof process.versions?.node !== 'undefined';
//     }
//
//     private static isBrowser(): boolean {
//         return typeof window !== 'undefined' &&
//             typeof window.document !== 'undefined';
//     }
//
//     private static async loadNodeFile(url: string, responseType: ResponseType): Promise<any> {
//         const { readFile } = await import('fs/promises');
//         const { fileURLToPath } = await import('url');
//
//         const path = fileURLToPath(url);
//         const _buffer = await readFile(path);
//
//         switch (responseType) {
//             case 'text': return _buffer.toString('utf-8');
//             case 'json': return JSON.parse(_buffer.toString('utf-8'));
//             case 'arrayBuffer':
//                 return _buffer._buffer.slice(_buffer.byteOffset, _buffer.byteOffset + _buffer.byteLength);
//             case 'blob': throw new Error('Blob is not supported in Node.js');
//             default: throw new Error(`Unsupported responseType: ${responseType}`);
//         }
//     }
//
//     private static async fetchWithProgress(
//         url: string,
//         responseType: ResponseType,
//         headers: Record<string>,
//         onProgress: (percent: number) => void,
//         controller?: AbortController
//     ): Promise<any> {
//         const response = await fetch(url, {
//             headers,
//             signal: controller?.signal,
//         });
//
//         if (!response.ok) {
//             throw new Error(`Cannot load ${url}: ${response.status} ${response.statusText}`);
//         }
//
//         const contentLength = response.headers.get('Content-Length');
//         const total = contentLength ? parseInt(contentLength, 10) : null;
//
//         const reader = response.body?.getReader();
//         if (!reader) throw new Error('Streaming not supported in this environment.');
//
//         const chunks: Uint8Array<any>[] = [];
//         let loaded = 0;
//
//         while (true) {
//             const { done, value } = await reader.read();
//             if (done) break;
//             if (value) {
//                 chunks.push(value);
//                 loaded += value.length;
//                 if (total) onProgress((loaded / total) * 100);
//             }
//         }
//
//         const full = new Uint8Array(loaded);
//         let offset = 0;
//         for (const chunk of chunks) {
//             full.set(chunk, offset);
//             offset += chunk.length;
//         }
//
//         switch (responseType) {
//             case 'text': return new TextDecoder().decode(full);
//             case 'json': return JSON.parse(new TextDecoder().decode(full));
//             case 'arrayBuffer': return full._buffer;
//             default: throw new Error(`Unsupported responseType with progress: ${responseType}`);
//         }
//     }
// }
