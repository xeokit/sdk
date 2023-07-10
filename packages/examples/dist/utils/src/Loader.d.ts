import { LoadingManager } from './LoadingManager';
declare class Loader {
    manager: LoadingManager;
    crossOrigin: string;
    withCredentials: boolean;
    path: string;
    resourcePath: string;
    requestHeader: {};
    constructor(manager: LoadingManager | undefined);
    load(url: string, onLoad: Function, onProgress: Function, onError: Function): void;
    loadAsync(url: string, onProgress: Function): Promise<unknown>;
    parse(): void;
    setCrossOrigin(crossOrigin: string): this;
    setWithCredentials(value: boolean): this;
    setPath(path: string): this;
    setResourcePath(resourcePath: string): this;
    setRequestHeader(requestHeader: {}): this;
}
export { Loader };
