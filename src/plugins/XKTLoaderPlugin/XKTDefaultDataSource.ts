import * as utils from "../../viewer/utils";
import {XKTDataSource} from "./XKTDataSource";

/**
 * Default data source through which {@link XKTLoaderPlugin} fetches ````.XKT```` files and metadata via HTTP.
 *
 * * {@link XKTLoaderPlugin.dataSource} has an instance of this by default
 */
export class XKTDefaultDataSource implements XKTDataSource {

    constructor() {
    }

    /**
     * Gets metamodel JSON.
     *
     * @param {String|Number} metaModelSrc Identifies the metamodel JSON asset.
     * @param {{Function(*)}} ok Fired on successful loading of the metamodel JSON asset.
     * @param {{Function(*)}} error Fired on error while loading the metamodel JSON asset.
     */
    getMetaModel(metaModelSrc: string, ok: (arg0: any) => void, error: (arg0: any) => void) {
        utils.loadJSON(metaModelSrc,
            (json) => {
                ok(json);
            },
            function (errMsg) {
                error(errMsg);
            });
    }

    /**
     * Gets the contents of the given ````.xkt```` file in an arraybuffer.
     *
     * @param {String|Number} src Path or ID of an ````.xkt```` file.
     * @param {Function} ok Callback fired on success, argument is the ````.xkt```` file in an arraybuffer.
     * @param {Function} error Callback fired on error.
     */
    getXKT(src: string, ok: (arg0: ArrayBuffer) => void, error: (arg0: string) => void) {
        var defaultCallback = () => {
        };
        ok = ok || defaultCallback;
        error = error || defaultCallback;
        const dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;
        const dataUriRegexResult = src.match(dataUriRegex);
        if (dataUriRegexResult) { // Safari can't handle data URIs through XMLHttpRequest
            const isBase64 = !!dataUriRegexResult[2];
            var data = dataUriRegexResult[3];
            data = window.decodeURIComponent(data);
            if (isBase64) {
                data = window.atob(data);
            }
            try {
                const buffer = new ArrayBuffer(data.length);
                const view = new Uint8Array(buffer);
                for (var i = 0; i < data.length; i++) {
                    view[i] = data.charCodeAt(i);
                }
                ok(buffer);
            } catch (errMsg) {
                error(errMsg);
            }
        } else {
            const request = new XMLHttpRequest();
            request.open('GET', src, true);
            request.responseType = 'arraybuffer';
            request.onreadystatechange = function () {
                if (request.readyState === 4) {
                    if (request.status === 200) {
                        ok(request.response);
                    } else {
                        error('getXKT error : ' + request.response);
                    }
                }
            };
            request.send(null);
        }
    }
}

