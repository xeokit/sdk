class LoadingManager {
    private isLoading: boolean;
    private itemsLoaded: number;
    private itemsTotal: number;
    private urlModifier: undefined;
    private handlers: any[];
    private onStart: Function|undefined;
    private onLoad: Function;
    private onProgress: Function;
    private onError: Function;

    constructor(onLoad: Function, onProgress: Function, onError: Function) {

        this.isLoading = false;
        this.itemsLoaded = 0;
        this.itemsTotal = 0;
        this.urlModifier = undefined;
        this.handlers = [];

        this.onStart = undefined;
        this.onLoad = onLoad;
        this.onProgress = onProgress;
        this.onError = onError;
    }

    itemStart(url: any) {
        this.itemsTotal++;
        if (!this.isLoading) {
            if (this.onStart !== undefined) {
                this.onStart(url, this.itemsLoaded, this.itemsTotal);
            }
        }
        this.isLoading = true;
    }

    itemEnd(url: any) {
        this.itemsLoaded++;
        if (this.onProgress !== undefined) {
            this.onProgress(url, this.itemsLoaded, this.itemsTotal);
        }
        if (this.itemsLoaded === this.itemsTotal) {
            this.isLoading = false;
            if (this.onLoad !== undefined) {
                this.onLoad();
            }
        }
    }

    itemError(url: any) {
        if (this.onError !== undefined) {
            this.onError(url);
        }
    }

    resolveURL(url: any) {
        if (this.urlModifier) {
            // @ts-ignore
            return this.urlModifier(url);
        }
        return url;
    }

    setURLModifier(transform: any) {
        this.urlModifier = transform;
        return this;
    }

    addHandler(regex: any, loader: any) {
        this.handlers.push(regex, loader);
        return this;
    }

    removeHandler(regex: any) {
        const index = this.handlers.indexOf(regex);
        if (index !== -1) {
            this.handlers.splice(index, 2);
        }
        return this;
    }

    getHandler(file: any) {
        for (let i = 0, l = this.handlers.length; i < l; i += 2) {
            const regex = this.handlers[i];
            const loader = this.handlers[i + 1];
            if (regex.global) regex.lastIndex = 0; // see #17920
            if (regex.test(file)) {
                return loader;
            }
        }
        return null;
    }
}

// @ts-ignore
const DefaultLoadingManager = new LoadingManager();

export {DefaultLoadingManager, LoadingManager};
