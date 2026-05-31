import {createCullKernel} from "./CullKernel";
import type {CullingInputMessage, CullingOutputMessage} from "./CullingProtocol";

/**
 * A minimal handle over the culling worker, so {@link SceneCuller} doesn't
 * depend on the DOM {@link Worker} shape and can be swapped in tests.
 */
export interface CullingWorkerHandle {

  /** Sends a message to the worker. */
  post(message: CullingInputMessage): void;

  /** Registers the (single) handler for messages coming back. */
  onMessage(handler: (message: CullingOutputMessage) => void): void;

  /** Stops the worker and releases it. */
  terminate(): void;
}

/**
 * Creates the culling worker by stringifying the self-contained
 * {@link createCullKernel} factory into a Blob.
 *
 * Why a Blob and not `new Worker(new URL("./cullingWorker.js", import.meta.url))`:
 * this SDK is bundled with esbuild and ships as TypeScript source, and esbuild
 * does not transform the `new URL(...)` worker pattern into a separate chunk.
 * An inline Blob needs no bundler support at all, so it works for every
 * consumer. The kernel closes over nothing from module scope, so its
 * `toString()` is valid standalone code in the worker.
 *
 * Requires a browser environment ({@link Worker} / {@link Blob}); throws
 * otherwise, since culling is a rendering-time concern.
 */
export function createCullingWorker(): CullingWorkerHandle {
  if (typeof Worker === "undefined" || typeof Blob === "undefined") {
    throw new Error("[culling] Web Workers are not available in this environment");
  }

  const source =
    `const kernel = (${createCullKernel.toString()})();\n` +
    `self.onmessage = (e) => kernel.handleMessage(e.data, (m) => self.postMessage(m));\n`;

  const url = URL.createObjectURL(new Blob([source], {type: "text/javascript"}));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);

  let handler: ((message: CullingOutputMessage) => void) | null = null;
  worker.onmessage = (event: MessageEvent) => {
    if (handler) {
      handler(event.data as CullingOutputMessage);
    }
  };

  return {
    post: (message) => worker.postMessage(message),
    onMessage: (h) => {
      handler = h;
    },
    terminate: () => worker.terminate()
  };
}
