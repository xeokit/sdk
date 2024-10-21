const CLASS_DOCS = {
    "WebGLRenderer": "https://xeokit.github.io/sdk/docs/api/modules/_xeokit_webglrenderer.html",
    "Viewer": "",
    "View": "",
    "ViewLayer": "",
    "SceneModel": "",
    "SceneMesh": "",
    "SceneGeometry": "",
    "SceneObject": "",
    "DataModel": "",
};

export class StatusLog {

    constructor(cfg = {}) {

        const div = document.createElement('div');
        div.id = 'status-container';
        div.className = 'status-container';
        document.body.appendChild(div); // You can change 'body' to any other container

        this.gitHubDataDir = cfg.gitHubDataDir || "https://github.com/xeokit/sdk/tree/develop/packages/demos/data/";
        this.statusContainer = div;
        this.statusMessages = [];

        this._dirty = true;

        setInterval(() => {
            if (this._dirty) {
                this._renderStatusMessages();
                this._dirty = false;
            }
        }, 500);
    }

    log(msg) {
        this.statusMessages.push(`${this.statusMessages.length + 1}: ${msg}`);
        if (this.statusMessages.length > 15) {
            this.statusMessages.shift();
        }
        this._dirty = true;
    }

    _renderStatusMessages() {
        this.statusContainer.innerHTML = '';
        this.statusMessages.forEach((message, index) => {
            const statusElement = document.createElement('div');
            statusElement.className = 'status-message';
            statusElement.innerHTML = message;
            if (index === 0 && this.statusMessages.length === 10) {
                statusElement.style.opacity = '0.5';
            }
            this.statusContainer.appendChild(statusElement);
        });
    }

    logCreateWebGLRenderer() {
        this.log(`Create <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_webglrenderer.html">WebGLRenderer</a>`);
    }

    logCreate(types) {
        const status = ["Create "];
        for (let i = 0, len = types.length; i < len; i++) {
            const type = types[i];
            status.push(`<a target="_parent" href="${CLASS_DOCS[type]}">${type}</a>${i < len - 1 ? ", " : (i === len - 1 ? " " : " & ")}`);
        }
        this.log(status.join(""));
    }

    logCreateViewer() {
        this.log(`Create <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_viewer.html">Viewer</a>`);
    }

    logCreateView() {
        this.log(`Create <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/classes/_xeokit_viewer.View.html">View</a>`);
    }

    logCreateCameraControl() {
        this.log(`Create <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_cameracontrol.html">CameraControl</a>`);
    }

    logCreateSceneModel() {
        this.log(`Create <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/classes/_xeokit_scene.SceneModel.html">SceneModel</a>`);
    }

    logCreateDataModel() {
        this.log(`Create <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/classes/_xeokit_data.DataModel.html">DataModel</a>`);
    }

    logBuildSceneModel() {
        this.log(`Build <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/classes/_xeokit_scene.SceneModel.html">SceneModel</a>`);
    }

    logBuildDataModel() {
        this.log(`Build <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_data.html">DataModel</a>`);
    }

    logViewingModel(modelId) {
        this.log(`Viewing model: <a href="${this.gitHubDataDir}models/${modelId}" target="_parent">${modelId}</a>`);
    }

    logImportPipeline(pipelineId) {
        this.log(`Model import pipeline: <a href="" target="_parent">${pipelineId}</a>`);
    }

    logLoadDotBIM() {
        this.log(`Load .BIM with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_dotbim.html">loadDotBIM</a>`);
    }

    logLoadLAZ() {
        this.log(`Load LAZ with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_las.html">loadLAS</a>`);
    }

    logLoadLAS() {
        this.log(`Load LAS with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_las.html">loadLAS</a>`);
    }

    logLoadCityJSON() {
        this.log(`Load CityJSON with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_cityjson.html">loadCityJSON</a>`);
    }

    logLoadWebIFC() {
        this.log(`Load IFC with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_webifc.html">loadWebIFC</a>`);
    }

    logFetch(src, formatName) {
        this.log(`Fetch ${formatName}: <a target="_parent" href="${this.gitHubDataDir}/${truncateUntilSubstring(src, "models")}">${truncateUntilSubstring(src, "models")}</a>`);
    }

    logLoadXGF() {
        this.log(`Load XGF with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_xgf.html">loadXGF</a>`);
    }

    logLoadGLTF() {
        this.log(`Load glTF with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_gltf.html">loadGLTF</a>`);
    }

    logLoadXKT() {
        this.log(`Load XKT with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_xkt.html">loadXKT</a>`);
    }

    logPointCamera(camera) {
        this.log(`Set <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_viewer.html">Camera</a> to look at [${camera.look.join(", ")}]`);
    }

    logLoadDataModelJSON() {
        this.log(`Load DataModel with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_data.html">DataModel.fromJSON</a>`);
    }

    logLoadSceneModelJSON() {
        this.log(`Load SceneModel with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_scene.html">SceneModel.fromJSON</a>`);
    }

    initWebIFC() {
        this.log(`Init <a target="_parent" href="https://github.com/ThatOpen">WebIFC</a>`);
    }

    logLoadModelGLTFChunksManifest() {
        this.log(`Load model manifest with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_modelchunksloader.html">ModelChunksLoader</a> and <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_gltf.html">loadGLTF</a>`);
    }

    logLoadModelXGFChunksManifest() {
        this.log(`Load model manifest with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_modelchunksloader.html">ModelChunksLoader</a> and <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_xgf.html">loadXGF</a>`);
    }

    logConvertIfc2gltfManifest() {
        this.log(`Convert model manifest with <a target="_parent" href="https://xeokit.github.io/sdk/docs/api/modules/_xeokit_ifc2gltf2xgf.html">convertIfc2gltfManifest</a>`);
    }

    logError(err) {
        this.log(`[ERROR] ${err}`);
    }

    finished() {

    }
}

function truncateUntilSubstring(str, substring) {
    const index = str.indexOf(substring);
    if (index !== -1) {
        return str.slice(index);
    }
    return str;
}
