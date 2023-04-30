declare class LoadingManager {
    private isLoading;
    private itemsLoaded;
    private itemsTotal;
    private urlModifier;
    private handlers;
    private onStart;
    private onLoad;
    private onProgress;
    private onError;
    constructor(onLoad: Function, onProgress: Function, onError: Function);
    itemStart(url: any): void;
    itemEnd(url: any): void;
    itemError(url: any): void;
    resolveURL(url: any): any;
    setURLModifier(transform: any): this;
    addHandler(regex: any, loader: any): this;
    removeHandler(regex: any): this;
    getHandler(file: any): any;
}
declare const DefaultLoadingManager: LoadingManager;
export { DefaultLoadingManager, LoadingManager };
