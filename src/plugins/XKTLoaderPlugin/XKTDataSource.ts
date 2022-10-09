/**
 * Data source through which {@link XKTLoaderPlugin} fetches ````.XKT```` files and metadata.
 */
export interface XKTDataSource {
    /**
     * Gets metaModel JSON.
     *
     * @param {String|Number} modelDataSrc Identifies the metaModel JSON asset.
     * @param {{Function(*)}} ok Fired on successful loading of the metaModel JSON asset.
     * @param {{Function(*)}} error Fired on error while loading the metaModel JSON asset.
     */
    getModelData(modelDataSrc: string, ok: (arg0: any) => void, error: (arg0: any) => void): void;

    /**
     * Gets the contents of the given ````.xkt```` file in an arraybuffer.
     *
     * @param {String|Number} src Path or ID of an ````.xkt```` file.
     * @param {Function} ok Callback fired on success, argument is the ````.xkt```` file in an arraybuffer.
     * @param {Function} error Callback fired on error.
     */
    getXKT(src: string, ok: (arg0: ArrayBuffer) => void, error: (arg0: string) => void): void;
}