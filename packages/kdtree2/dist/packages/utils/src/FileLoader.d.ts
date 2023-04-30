import { Loader } from './Loader';
import type { LoadingManager } from "./LoadingManager";
declare class FileLoader extends Loader {
    mimeType: string;
    responseType: string;
    constructor(manager?: LoadingManager);
    load(url: string, onLoad: Function, onProgress: Function, onError: Function): any;
    setResponseType(value: string): this;
    setMimeType(value: string): this;
}
export { FileLoader };
