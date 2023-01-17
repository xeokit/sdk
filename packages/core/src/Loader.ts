import {DefaultLoadingManager, LoadingManager} from './LoadingManager';

class Loader {
     manager: LoadingManager;
     crossOrigin: string;
     withCredentials: boolean;
     path: string;
     resourcePath: string;
     requestHeader: {};

    constructor(manager: LoadingManager | undefined) {

        this.manager = (manager !== undefined) ? manager : DefaultLoadingManager;

        this.crossOrigin = 'anonymous';
        this.withCredentials = false;
        this.path = '';
        this.resourcePath = '';
        this.requestHeader = {};
    }

    load(url: string, onLoad: Function, onProgress: Function, onError: Function) {
    }

    loadAsync(url: string, onProgress: Function) {
        const scope = this;
        return new Promise(function (resolve, reject) {
            // @ts-ignore
            scope.load(url, resolve, onProgress, reject);
        });
    }

    parse( /* data */) {
    }

    setCrossOrigin(crossOrigin: string) {
        this.crossOrigin = crossOrigin;
        return this;
    }

    setWithCredentials(value: boolean) {
        this.withCredentials = value;
        return this;
    }

    setPath(path: string) {
        this.path = path;
        return this;
    }

    setResourcePath(resourcePath: string) {
        this.resourcePath = resourcePath;
        return this;
    }

    setRequestHeader(requestHeader: {}) {
        this.requestHeader = requestHeader;
        return this;
    }
}

export {Loader};
