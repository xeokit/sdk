export class WebGLRenderer {

    constructor(viewer, cfg, done) {
        this.viewer = viewer;
        this.scene = viewer.scene;
        this.initialized = false;
        this._pickIDs = new Map({});
        this._drawableTypeInfo = {};
        this._drawables = {};
        this._drawableListDirty = true;
        this._stateSortDirty = true;
        this._imageDirty = true;
        this.views = {};

        if (navigator.gpu) {
            navigator.gpu.requestAdapter({powerPreference: "high-performance"})
                .then(adapter => {
                    adapter.requestDevice({})
                        .then(device => {
                            this.adapter = adapter
                            this.device = device;
                            this._initialized = true;
                            done.call(this, true);
                        });
                }).catch(error => {
                this.initialized = false;
                done(false, error);
            });
        } else {
            this.initialized = false;
            done(false, 'navigate.gpu is null');
        }
    }

    needStateSort() {
        this._stateSortDirty = true;
    }

    shadowsDirty() {

    }

    imageDirty() {

    }

    addView(id, view) {
        this.views[id] = view;
    }

    removeView(id) {
        delete this.views[id];
    }

    addDrawable(id, drawable) {
        const type = drawable.type;
        if (!type) {
            console.error("Renderer#addDrawable() : drawable with ID " + id + " has no 'type' - ignoring");
            return;
        }
        let drawableInfo = this._drawableTypeInfo[type];
        if (!drawableInfo) {
            drawableInfo = {
                type: drawable.type,
                count: 0,
                isStateSortable: drawable.isStateSortable,
                stateSortCompare: drawable.stateSortCompare,
                drawableMap: {},
                drawableListPreCull: [],
                drawableList: []
            };
            this._drawableTypeInfo[type] = drawableInfo;
        }
        drawableInfo.count++;
        drawableInfo.drawableMap[id] = drawable;
        this._drawables[id] = drawable;
        this._drawableListDirty = true;
    }

    removeDrawable(id) {
        const drawable = this._drawables[id];
        if (!drawable) {
            console.error("Renderer#removeDrawable() : drawable not found with ID " + id + " - ignoring");
            return;
        }
        const type = drawable.type;
        const drawableInfo = this._drawableTypeInfo[type];
        if (--drawableInfo.count <= 0) {
            delete this._drawableTypeInfo[type];
        } else {
            delete drawableInfo.drawableMap[id];
        }
        delete this._drawables[id];
        this._drawableListDirty = true;
    }

    getPickID(entity) {
        return this._pickIDs.addItem(entity);
    }

    putPickID(pickId) {
        this._pickIDs.removeItem(pickId);
    }

    clear(params) {
        params = params || {};
        //...
    }

    render(params) {
        params = params || {};
        if (params.force) {
            this._imageDirty = true;
        }
        this._updateDrawlist();
        if (this._imageDirty) {
            this._draw(params);
            this._imageDirty = false;
        }
    }

    _updateDrawlist() { // Prepares state-sorted array of drawables from maps of inserted drawables
        if (this._drawableListDirty) {
            this._buildDrawableList();
            this._drawableListDirty = false;
            this._stateSortDirty = true;
        }
        if (this._stateSortDirty) {
            this._sortDrawableList();
            this._stateSortDirty = false;
            this._imageDirty = true;
        }
        if (this._imageDirty) { // Image is usually dirty because the camera moved
            this._cullDrawableList();
        }
    }

    _buildDrawableList() {
        for (let type in this._drawableTypeInfo) {
            if (this._drawableTypeInfo.hasOwnProperty(type)) {
                const drawableInfo = this._drawableTypeInfo[type];
                const drawableMap = drawableInfo.drawableMap;
                const drawableListPreCull = drawableInfo.drawableListPreCull;
                let lenDrawableList = 0;
                for (let id in drawableMap) {
                    if (drawableMap.hasOwnProperty(id)) {
                        drawableListPreCull[lenDrawableList++] = drawableMap[id];
                    }
                }
                drawableListPreCull.length = lenDrawableList;
            }
        }
    }

    _sortDrawableList() {
        for (let type in this._drawableTypeInfo) {
            if (this._drawableTypeInfo.hasOwnProperty(type)) {
                const drawableInfo = this._drawableTypeInfo[type];
                if (drawableInfo.isStateSortable) {
                    drawableInfo.drawableListPreCull.sort(drawableInfo.stateSortCompare);
                }
            }
        }
    }

    _cullDrawableList() {
        for (let type in this._drawableTypeInfo) {
            if (this._drawableTypeInfo.hasOwnProperty(type)) {
                const drawableInfo = this._drawableTypeInfo[type];
                const drawableListPreCull = drawableInfo.drawableListPreCull;
                const drawableList = drawableInfo.drawableList;
                let lenDrawableList = 0;
                for (let i = 0, len = drawableListPreCull.length; i < len; i++) {
                    const drawable = drawableListPreCull[i];
                    drawable.rebuildRenderFlags();
                    if (!drawable.renderFlags.culled) {
                        drawableList[lenDrawableList++] = drawable;
                    }
                }
                drawableList.length = lenDrawableList;
            }
        }
    }

    _draw(params) {
    }


    pick(params, pickResult) {
    }

    addMarker(occludable) {
    }

    markerWorldPosUpdated(occludable) {

    }

    removeMarker(occludable) {

    }

    doOcclusionTest() {

    }

    readPixels(pixels, color, len, opaqueOnly) {

    }

    beginSnapshot() {

    }

    renderSnapshot() {

    }

    readSnapshot(params) {

    }

    endSnapshot() {

    }

    destroy() {

    }
}
