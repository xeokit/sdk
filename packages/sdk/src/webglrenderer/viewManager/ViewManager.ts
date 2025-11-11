import {RenderContext} from "./RenderContext";
import {Camera, TickParams, View, Viewer, ViewObject} from "../../viewer";
import {SDKError, SDKErrorType, SDKResult} from "../../core";
import {RendererView} from "./RendererView";
import {RenderManager} from "./renderManager/RenderManager";
import {PickManager} from "./pickManager/PickManager";
import {GPUMemoryManager} from "./gpuMemoryManager/GPUMemoryManager";
import {MeshManager} from "./meshManager/MeshManager";
import {GPUMemoryEditor} from "./gpuMemoryManager/GPUMemoryEditor";
import {GPUMemoryReader} from "./gpuMemoryManager/GPUMemoryReader";
import {SceneMesh, SceneModel, SceneObject} from "../../scene";
import {SceneTransform} from "../../scene/SceneTransform";

/**
 * Manages the viewManager in the WebGLRenderer.
 */
export class ViewManager {

    private _viewer: Viewer;
    private _renderContext: RenderContext;
    private _rendererViews: Record<string, RendererView> = {};
    private _rendererViewsList: RendererView[] = [];
    private _activeView: RendererView;
    private _renderManager: RenderManager;
    private _pickManager: PickManager;
    private _gpuMemoryManager: GPUMemoryManager;
    private _meshManager: MeshManager;

    /**
     * Constructs a ViewManager.
     * Call init() to initialize.
     */
    constructor() {
    }

    /**
     * Initializes the ViewManager with the given Viewer.
     * Separate init method is used to allow for error handling.
     * @param viewer
     */
    public init(viewer: Viewer): SDKResult<void, string> {

        this._viewer = viewer;

        if (viewer.viewList.length >= 4) { // TODO: Capabilities.maxViews
            return {
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "Maximum number of Views exceeded"
            };
        }

        this._renderContext = new RenderContext();

        const resultCtx = this._renderContext.init(viewer);

        if (resultCtx.ok === false) {
            return resultCtx;
        }

        this._gpuMemoryManager = new GPUMemoryManager(this._renderContext);

        const resultGPU = this._gpuMemoryManager.init();

        if (resultGPU.ok === false) {
            return resultGPU;
        }

        this._meshManager = new MeshManager(this._renderContext, this._gpuMemoryManager as GPUMemoryEditor);

        const resultMesh = this._meshManager.init();

        if (resultMesh.ok === false) {
            return resultMesh;
        }

        this._renderManager = new RenderManager({
            renderContext: this._renderContext,
            meshManager: this._meshManager,
            gpuMemoryReader: this._gpuMemoryManager as GPUMemoryReader
        });

        this._pickManager = new PickManager({
            renderContext: this._renderContext,
            meshManager: this._meshManager,
            gpuMemoryManager: this._gpuMemoryManager
        });

        for (const view of viewer.viewList) {
            const result = this.viewCreated(view);
            if (!result.ok) {
                return result;
            }
        }

        return {
            ok: true,
            value: undefined
        };
    }

    public onTick(tickParams: TickParams /* Unused ATM */): void {
        this._gpuMemoryManager.uploadChanges();
    }

    public get viewer(): Viewer {
        return this._viewer;
    }

    public viewCreated(view: View): SDKResult<any, string> {
        if (this._rendererViews[view.id]) {
            throw new SDKError("Can't add additional View to WebGLRenderer - View already added");
        }
        if (this._rendererViewsList.length >= 4) { // TODO: Capabilities.maxViews
            return {
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: `Maximum number of Views exceeded - max allowed is 4`
            };
        }
        const rendererView = new RendererView(
            this._renderContext,
            this._pickManager,
            this._renderManager,
            view);
        this._rendererViews[view.id] = rendererView;
        view.viewIndex = this._rendererViewsList.length;
        this._rendererViewsList.push(rendererView);
        return {
            ok: true,
            value: undefined
        };
    }

    public get rendererViews(): RendererView[] {
        return this._rendererViewsList;
    }

    public viewUpdated(view: View):void {
        const rendererView = this._rendererViews[view.id];
        if (!rendererView) {
            throw new SDKError("View is not added");
        }
        if (this._activeView !== rendererView) {
            this._activateView(rendererView);
        }
        this._renderManager.render(rendererView, {clear: true});
    }

    private _activateView(rendererView: RendererView):void {
        const activeRendererView = this._activeView;
        if (activeRendererView) {
            const activeCanvasBoundingRect = activeRendererView.view.htmlElement.getBoundingClientRect();
            const primarySnapshotBuffer = activeRendererView.renderBuffers.getRenderBuffer("snapshot", {
                depthTexture: false,
                size: [activeCanvasBoundingRect.width, activeCanvasBoundingRect.height]
            });
            primarySnapshotBuffer.bind();
            primarySnapshotBuffer.clear();
            this._renderManager.render(rendererView, {clear: true});
            const image = primarySnapshotBuffer.readImage({
                format: "png",
                height: activeCanvasBoundingRect.height,
                width: activeCanvasBoundingRect.width
            });
            primarySnapshotBuffer.unbind();
            (<HTMLImageElement>activeRendererView.view.htmlElement).src = image;
        }
        const view = rendererView.view;
        const htmlElement = view.htmlElement;
        const boundingRect = htmlElement.getBoundingClientRect();
        const webglCanvasElement = this._renderContext.webglCanvasElement;
        webglCanvasElement.style["left"] = `${boundingRect.left}px`;
        webglCanvasElement.style["top"] = `${boundingRect.top}px`;
        webglCanvasElement.style["width"] = `${boundingRect.width}px`;
        webglCanvasElement.style["height"] = `${boundingRect.height}px`;
        webglCanvasElement.width = boundingRect.width;
        webglCanvasElement.height = boundingRect.height;
        webglCanvasElement.style["z-tileIndex"] = 100000;
        this._activeView = rendererView;
    }

    public viewDestroyed(view: View): void {
        const rendererView = this._rendererViews[view.id];
        if (!rendererView) {
            throw new SDKError("View is not added");
        }
        rendererView.destroy();
        delete this._rendererViews[view.id];
        //  TODO: Set rendererViewsList dirty
    }

    public sceneModelCreated(sceneModel: SceneModel):void {
        this._meshManager.sceneModelCreated(sceneModel);
    }

    public sceneModelDestroyed(sceneModel: SceneModel):void {
        this._meshManager.sceneModelDestroyed(sceneModel);
    }

    public sceneObjectCreated(sceneObject: SceneObject):SDKResult<any, string> {
        return this._meshManager.sceneObjectCreated(sceneObject);
    }

    public sceneObjectDestroyed(sceneObject: SceneObject):void {
        this._meshManager.sceneObjectDestroyed(sceneObject);
    }

    public sceneMeshMatrixChanged(sceneMesh: SceneMesh):void {
        this._meshManager.sceneMeshMatrixChanged(sceneMesh);
    }

    public sceneMeshColorChanged(sceneMesh: SceneMesh):void {
        this._meshManager.sceneMeshColorChanged(sceneMesh);
    }

    public sceneTransformMatrixChanged(sceneMesh: SceneTransform):void {
        this._meshManager.sceneTransformMatrixChanged(sceneMesh);
    }

    public viewObjectVisibilityChanged(viewObject: ViewObject):void {
        this._meshManager.viewObjectVisibilityChanged(viewObject);
    }

    public viewObjectXRayedChanged(viewObject: ViewObject):void {
        this._meshManager.viewObjectXRayedChanged(viewObject);
    }

    public viewObjectHighlightedChanged(viewObject: ViewObject):void {
        this._meshManager.viewObjectHighlightedChanged(viewObject);
    }

    public viewObjectSelectedChanged(viewObject: ViewObject):void {
        this._meshManager.viewObjectSelectedChanged(viewObject);
    }

    public viewObjectColorizeChanged(viewObject: ViewObject):void {
        this._meshManager.viewObjectColorizeChanged(viewObject);
    }

    public viewObjectOpacityChanged(viewObject: ViewObject):void {
        this._meshManager.viewObjectOpacityChanged(viewObject);
    }

    public cameraViewMatrixUpdated(camera: Camera):void {
        this._meshManager.cameraViewMatrixUpdated(camera);
    }

    public destroy(): void {
        const viewer = this._renderContext.viewer;
        for (let viewIndex = 0; viewIndex < viewer.numViews; viewIndex++) {
            this.viewDestroyed(viewer.viewList[viewIndex]);
        }
        this._rendererViews = {};
        this._pickManager?.destroy();
        this._renderManager?.destroy();
        this._meshManager?.destroy();
        this._gpuMemoryManager?.destroy();
        this._pickManager = undefined as unknown as PickManager;
        this._renderManager = undefined as unknown as RenderManager;
        this._meshManager = undefined as unknown as MeshManager;
        this._gpuMemoryManager = undefined as unknown as GPUMemoryManager;
        this._renderContext.destroy();
        this._viewer = undefined as unknown as Viewer;
    }
}
