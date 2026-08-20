/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_viewer_logo.png"/>
 *
 * # xeokit Viewer
 *
 * ---
 *
 * ***The SDK's browser-based 3D/2D Viewer for xeokit Scenes***
 *
 * ---
 *
 * This module allows you to display and interact with a {@link model!scene.Scene | Scene} in the browser.
 *
 * If you’re new to xeokit’s model representation, start with:
 *
 * * {@link scene | @xeokit/sdk/model/scene} for geometry/material content, and
 * * {@link data | @xeokit/sdk/model/data} for semantic graphs you can attach to models.
 *
 * This Viewer module focuses on the interactive layer: Views, Cameras, picking, emphasis effects (highlight/selection/x-ray),
 * section planes, lighting, and render profiles.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class Viewer {
 *       +scene  : Scene
 *       +views  : Map~id, View~
 *       +events : ViewerEvents
 *       +attachScene(scene)
 *       +detachScene()
 *       +createView(params) SDKResult~View~
 *       +destroyView(id)
 *       +destroy()
 *     }
 *     class View {
 *       +id           : string
 *       +camera       : Camera
 *       +objects      : Map~id, ViewObject~
 *       +layers       : Map~id, ViewLayer~
 *       +sectionPlanes: Map~id, SectionPlane~
 *       +lights       : Lights
 *       +effects      : Effects
 *       +htmlElement  : HTMLCanvasElement
 *       +setObjectsVisible / Highlighted / Selected / XRayed / Clippable / Pickable
 *     }
 *     class Camera {
 *       +eye / look / up
 *       +viewMatrix / projMatrix
 *       +projection / fovy / near / far
 *     }
 *     class ViewObject {
 *       +id / sceneObject
 *       +visible / highlighted / selected / xrayed
 *       +color / opacity
 *     }
 *     class ViewLayer {
 *       +id
 *       +objects : Map
 *       +setObjectsVisible(...)
 *     }
 *     class SectionPlane {
 *       +dir / dist / active
 *     }
 *     class Scene {
 *       <<scene>>
 *     }
 *     Viewer "1" *-- "*" View
 *     Viewer "1" *-- "1" ViewerEvents
 *     Viewer o-- Scene : attached
 *     View "1" *-- "1" Camera
 *     View "1" *-- "*" ViewObject
 *     View "1" *-- "*" ViewLayer
 *     View "1" *-- "*" SectionPlane
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **One Viewer, many Views** — a single Viewer can drive several
 *   {@link View | Views}, each painting into its own canvas. Useful
 *   for multi-pane workflows (plan + elevation + 3D side-by-side).
 * - **Per-object state** — every Scene object surfaces as a
 *   {@link ViewObject | ViewObject} per View with independent
 *   visible / highlighted / selected / xrayed / clippable /
 *   pickable / colour / opacity flags. Toggle one object in one View
 *   without disturbing another.
 * - **ViewLayers** — group ViewObjects into named
 *   {@link ViewLayer | ViewLayers} (default, drawings, ghosted, …)
 *   so the host can hide / show / restyle a logical batch in one
 *   call.
 * - **Section planes** — arbitrary world-space clipping planes per
 *   View; pair with {@link presentations!sectionCaps | sectionCaps}
 *   to fill the cuts.
 * - **Emphasis effects** — highlight, selection, x-ray, edges, all
 *   driven by per-object boolean flags and a per-View material
 *   palette.
 * - **Lighting + IBL + tonemap** — directional / point / ambient
 *   lights plus image-based lighting; HDR pipeline with bloom +
 *   FXAA/SMAA + tonemap (Reinhard / ACES / linear).
 * - **Render profiles** — `realistic profile` (full PBR + IBL +
 *   shadows), `detailed profile` (engineering-style with hatched
 *   bodies + section caps), `EdgeRender`, etc.
 * - **Picking** — `View.pickByCanvasPos` routes through the
 *   {@link spatial!picking | spatial.picking} strategies for BVH /
 *   GPU / snap-aware picking.
 * - **Snapshot capture** — `View.getSnapshot()` returns the View's
 *   canvas as an HTMLImageElement / dataURL / ImageBitmap for
 *   sharing or report generation.
 *
 * <br>
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * <br>
 *
 * # Tutorial
 *
 * This tutorial walks through a minimal setup and then adds common interaction features step by step.
 *
 * <br>
 *
 * ## 1) Import modules
 *
 * ````javascript
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
 *
 * import {
 *   OrthoProjectionType,
 *   PerspectiveProjectionType,
 *   TrianglesPrimitive,
 *   LinearEncoding,
 *   LinearFilter
 * } from "@xeokit/sdk/base/constants";
 * ````
 *
 * <br>
 *
 * ## 2) Create a Scene, Viewer and WebGLRenderer
 *
 * Start by creating a {@link model!scene.Scene | Scene}. The Scene is the SDK’s in-memory scene graph: it owns the model
 * representation (SceneModels, objects, meshes, geometries, textures) and is where model content is created, updated,
 * imported, and exported. For a deeper introduction to Scene content and building/importing models, see
 * {@link scene | @xeokit/sdk/model/scene}.
 *
 * Next, create a {@link viewing!viewer.Viewer | Viewer}. The Viewer is the browser-facing facade for interactive viewing: it manages one or more
 * {@link View | Views} (canvases), user interaction state (camera control, picking, emphasis effects, section planes,
 * etc), and it provides a Viewer-centric event stream that reflects interactions and viewer-side changes.
 *
 * Finally, attach a {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer}. The WebGLRenderer is the rendering backend that
 * listens to changes and draws the Scene into the View canvases using the browser’s WebGL API.
 *
 * The runtime event flow is:
 *
 * * The Scene emits events when its content changes (models loaded, objects created/destroyed, transforms updated, etc).
 * * The Viewer receives those Scene changes (via the attached Scene) and emits Viewer events as user interaction and
 *   view configuration changes occur (camera moves, section planes added, objects highlighted/selected/x-rayed, etc).
 * * The WebGLRenderer listens to both streams to keep GPU resources in sync and re-render Views whenever something changes.
 *
 * ````javascript
 * const scene = new Scene();
 *
 * const viewer = new Viewer({
 *   scene
 * });
 *
 * const renderer = new WebGLRenderer({
 *   viewer
 * });
 * ````
 *
 * <br>
 *
 * ## 3) Create a View (canvas) and enable camera controls
 *
 * A {@link viewing!viewer.Viewer | Viewer} renders into one or more {@link View | Views}. Each View has its own canvas, camera, and per-object visual state.
 *
 * ````javascript
 * const view1Result = viewer.createView({
 *   id: "myView",
 *   elementId: "myView1"
 * });
 *
 * if (!view1Result.ok) {
 *   console.error(view1Result.error);
 *   // handle error...
 * }
 *
 * const view1 = view1Result.value;
 *
 * const viewController = new ViewController({
 *   view: view1
 * });
 * ````
 *
 * <br>
 *
 * ## 4) Position the camera
 *
 * ````javascript
 * view1.camera.eye = [-3.93, 2.85, 27.01];
 * view1.camera.look = [4.40, 3.72, 8.89];
 * view1.camera.up = [-0.01, 0.99, 0.03];
 * ````
 *
 * <br>
 *
 * ## 5) Choose a projection (orthographic or perspective)
 *
 * ````javascript
 * view1.projectionType = OrthoProjectionType;
 * // view1.projectionType = PerspectiveProjectionType;
 *
 * view1.perspectiveProjection.fov = 60.0;
 * view1.orthoProjection.scale = 1.0;
 * ````
 *
 * <br>
 *
 * ## 6) Align navigation to a world axis convention
 *
 * Configure {@link Camera.worldAxis | worldAxis} to match your domain’s coordinate system. This affects navigation behavior when using {@link viewing!viewController.ViewController | ViewController}.
 *
 * +Y up (+X right, -Z forward):
 *
 * ````javascript
 * view1.camera.worldAxis = [
 *   1, 0, 0, // Right
 *   0, 1, 0, // Up
 *   0, 0, -1 // Forward
 * ];
 * ````
 *
 * +Z up (+X right, -Y forward):
 *
 * ````javascript
 * view1.camera.worldAxis = [
 *   1, 0, 0, // Right
 *   0, 0, 1, // Up
 *   0, -1, 0 // Forward
 * ];
 * ````
 *
 * <br>
 *
 * ## 7) Add some content
 *
 * For a full walkthrough on creating and importing geometry, see {@link scene | @xeokit/sdk/model/scene}.
 * Below is a tiny example that creates a model with a few objects so you can try interactions immediately:
 *
 * ````javascript
 * const sceneModelResult = scene.createModel({
 *   id: "myModel"
 * });
 *
 * if (!sceneModelResult.ok) {
 *   console.error(sceneModelResult.error);
 *   // handle error...
 * }
 *
 * const sceneModel = sceneModelResult.value;
 *
 * sceneModel.createGeometry({
 *   id: "myGeometry",
 *   primitive: TrianglesPrimitive,
 *   positions: [202, 202, 202, 200, 202, 202 ...],
 *   indices: [0, 1, 2, 0, 2, 3 ...]
 * });
 *
 * sceneModel.createTexture({
 *   id: "myColorTexture",
 *   src: "myTexture",
 *   encoding: LinearEncoding,
 *   magFilter: LinearFilter,
 *   minFilter: LinearFilter
 * });
 *
 * sceneModel.createMaterial({
 *   id: "myMaterial",
 *   colorTextureId: "myColorTexture"
 * });
 *
 * sceneModel.createLayerMesh({
 *   id: "myMesh1",
 *   geometryId: "myGeometry",
 *   materialId: "myMaterial"
 * });
 *
 * sceneModel.createLayerMesh({
 *   id: "myMesh2",
 *   geometryId: "myGeometry",
 *   materialId: "myMaterial"
 * });
 *
 * sceneModel.createLayerMesh({
 *   id: "myMesh3",
 *   geometryId: "myGeometry",
 *   materialId: "myMaterial"
 * });
 *
 * sceneModel.createObject({
 *   id: "myObject1",
 *   meshIds: ["myMesh1"]
 * });
 *
 * sceneModel.createObject({
 *   id: "myObject2",
 *   meshIds: ["myMesh2"]
 * });
 *
 * sceneModel.createObject({
 *   id: "myObject3",
 *   meshIds: ["myMesh3"]
 * });
 * ````
 *
 * <br>
 *
 * ## 8) Emphasis effects: highlight, select, x-ray, and colorize
 *
 * Toggle effects in batches:
 *
 * ````javascript
 * view1.setObjectsHighlighted(["myObject1"], true);
 * view1.setObjectsSelected(["myObject2"], true);
 * view1.setObjectsXRayed(["myObject3"], true);
 * view1.setObjectsColorized(["myObject1"], [1, 0, 0]);
 * ````
 *
 * Or set state directly on a {@link viewing!viewer.ViewObject | ViewObject}:
 *
 * ````javascript
 * view1.objects["myObject1"].highlighted = true;
 * view1.objects["myObject2"].selected = true;
 * view1.objects["myObject3"].xrayed = true;
 *
 * view1.objects["myObject1"].colorize = [1, 0, 0];
 * view1.objects["myObject1"].colorize = null; // clear
 * ````
 *
 * <br>
 *
 * ## 9) Slice the scene with SectionPlanes
 *
 * Create a {@link SectionPlane}:
 *
 * ````javascript
 * const sectionPlaneResult = view1.createSectionPlane({
 *   id: "sectionPlane1",
 *   pos: [0, 0, 0],
 *   dir: [-1, -1, -1]
 * });
 *
 * if (!sectionPlaneResult.ok) {
 *   console.error(sectionPlaneResult.error);
 *   // handle error...
 * }
 *
 * const sectionPlane1 = sectionPlaneResult.value;
 * ````
 *
 * Animate it:
 *
 * ````javascript
 * sectionPlane1.dir = [-1, -1, 1];
 * sectionPlane1.pos = [1, 0, 0];
 * ````
 *
 * Keep specific objects unaffected:
 *
 * ````javascript
 * view1.setObjectsClippable(["myObject1"], false);
 * // or:
 * view1.objects["myObject1"].clippable = false;
 * ````
 *
 * <br>
 *
 * ## 10) Customize lighting
 *
 * ````javascript
 * view1.clearLights();
 *
 * const lightResult = view1.createDirLight({
 *   id: "dirLight1",
 *   dir: [-1, -1, -1],
 *   color: [0.9, 0.9, 0.9],
 *   intensity: 0.9
 * });
 *
 * if (!lightResult.ok) {
 *   console.error(lightResult.error);
 *   // handle error...
 * }
 *
 * view1.createPointLight({
 *   id: "pointLight1",
 *   pos: [-100, 10, -100],
 *   color: [0.9, 0.9, 1.0],
 *   intensity: 1.0,
 *   constantAttenuation: 0.8,
 *   linearAttenuation: 0.9,
 *   quadraticAttenuation: 0.9
 * });
 *
 * view1.createAmbientLight({
 *   id: "ambientLight1",
 *   color: [0.5, 0.5, 0.6],
 *   intensity: 0.7
 * });
 * ````
 *
 * <br>
 *
 * ## 11) Add a second View
 *
 * Multiple {@link View | Views} can render the same Scene with different camera positions and visual states.
 *
 * ````javascript
 * const view2Result = viewer.createView({
 *   id: "myView2",
 *   elementId: "myView2"
 * });
 *
 * if (!view2Result.ok) {
 *   console.error(view2Result.error);
 *   // handle error...
 * }
 *
 * const view2 = view2Result.value;
 *
 * view2.camera.eye = [-3.933, 2.855, 27.018];
 * view2.camera.look = [4.400, 3.724, 8.899];
 * view2.camera.up = [-0.018, 0.999, 0.039];
 *
 * const cameraControl2 = new ViewController({
 *   view: view2
 * });
 *
 * view2.objects["myObject1"].highlighted = true;
 * ````
 *
 * <br>
 *
 * ## 12) Organize objects with ViewLayers
 *
 * {@link ViewLayer | ViewLayers} let you apply operations to groups of objects (visibility, selection, clipping, etc).
 * ViewLayers are created in a {@link viewing!viewer.View | View} and are populated based on the {@link model!scene.SceneObject.layerId | layerId}
 * of the underlying {@link model!scene.SceneObject | SceneObjects}.
 *
 * ````javascript
 * const environmentLayerRes = view1.createLayer({
 *   id: "myEnvironmentViewLayer"
 * });
 *
 * if (!environmentLayerRes.ok) {
 *   console.error(environmentLayerRes.error);
 * }
 *
 * const environmentLayer = environmentLayerRes.value;
 * ````
 *
 * Hide everything in a layer:
 *
 * ````javascript
 * environmentLayer.setObjectsVisible(environmentLayer.objectIds, false);
 * ````
 *
 * <br>
 *
 * ## 13) Save and load BCF viewpoints
 *
 * Use BCF to exchange viewpoints with other BIM tools. For background and semantic context, see {@link data | @xeokit/sdk/model/data}.
 *
 * ````javascript
 * import { saveBCFViewpoint, loadBCFViewpoint } from "@xeokit/sdk/interop/bcf";
 *
 * const bcfViewpointResult = saveBCFViewpoint({
 *   view: view1,
 *   excludeViewLayerIds: ["myEnvironmentViewLayer"]
 * });
 *
 * if (!bcfViewpointResult.ok) {
 *   console.log("Error saving BCF viewpoint:", bcfViewpointResult.error);
 * }
 *
 * const bcfViewpoint = bcfViewpointResult.value;
 *
 * const loadBCFResult = loadBCFViewpoint({
 *   bcfViewpoint,
 *   view: view1,
 *   excludeViewLayerIds: ["myEnvironmentViewLayer"]
 * });
 *
 * if (!loadBCFResult.ok) {
 *   console.log("Error loading BCF viewpoint:", loadBCFResult.error);
 * }
 * ````
 *
 * <br>
 *
 * ## 14) Switch render profiles
 *
 * ViewProfiles let you enable/disable effects as a group (eg. quality vs performance)
 * without making individual effects aware of application profile names.
 *
 * ````javascript
 * import {DEFAULT_VIEW_PROFILES, ViewProfiles} from "@xeokit/sdk/viewing/viewProfiles";
 *
 * const profiles = new ViewProfiles(view1, {
 *   profiles: DEFAULT_VIEW_PROFILES,
 *   activeProfile: "realistic"
 * });
 *
 * profiles.setActiveProfile("fast");
 * profiles.setActiveProfile("detailed");
 * profiles.setActiveProfile("realistic");
 * ````
 *
 * <br>
 *
 * ## 15) Serialize and restore Viewer configuration
 *
 * Use {@link Viewer.toParams} and {@link Viewer.fromParams} to copy Viewer configuration between instances
 * (Views, Cameras, SectionPlanes, Lights, materials, and more).
 *
 * ````javascript
 * const viewerParamsResult = viewer.toParams();
 * const viewerParams = viewerParamsResult.value;
 *
 * const viewer2 = new Viewer({
 *   scene: new Scene()
 * });
 *
 * const renderer2 = new WebGLRenderer({
 *   viewer: viewer2
 * });
 *
 * const fromParamsResult = viewer2.fromParams(viewerParams);
 * if (!fromParamsResult.ok) {
 *   console.error("Error loading ViewerParams:", fromParamsResult.error);
 * }
 * ````
 *
 * @module viewer
 */

export * from "./Viewer";
export * from "./ViewerEvents";
export * from "./ViewerParams";
export * from "./ViewParams";
export * from "./Camera";
export * from "./CameraParams";
export * from "./Projection";
export * from "./FrustumProjection";
export * from "./FrustumProjectionParams";
export * from "./OrthoProjection";
export * from "./OrthoProjectionParams";
export * from "./PerspectiveProjection";
export * from "./PerspectiveProjectionParams";
export * from "./CustomProjection";
export * from "./CustomProjectionParams";
export * from "./AmbientLight";
export * from "./AmbientLightParams";
export * from "./DirLight";
export * from "./DirLightParams";
export * from "./PointLight";
export * from "./PointLightParams";
export * from "./Effect";
export * from "./EffectParams";
export * from "./Edges";
export * from "./EdgesParams";
export * from "./PointsMaterial";
export * from "./PointsMaterialParams";
export * from "./LinesMaterial";
export * from "./View";
export * from "./ViewParams";
export * from "./ViewLayer";
export * from "./ViewLayerParams";
export * from "./ViewObject";
export * from "./ViewTransform";
export * from "./ViewTransformParams";
export * from "./SectionPlane";
export * from "./SectionPlaneParams";
export * from "./SAO";
export * from "./SAOParams";
export * from "./Shadows";
export * from "./ShadowsParams";
export * from "./Sky";
export * from "./SkyParams";
export * from "./Tonemap";
export * from "./TonemapParams";
export * from "./AntiAliasing";
export * from "./AntiAliasingParams";
export * from "./Bloom";
export * from "./BloomParams";
export * from "./Atmosphere";
export * from "./AtmosphereParams";
export * from "./DepthOfField";
export * from "./DepthOfFieldParams";
export * from "./HemisphereAmbient";
export * from "./HemisphereAmbientParams";
export * from "./IBL";
export * from "./IBLParams";
export * from "./Lights";
export * from "./LightsParams";
export * from "./Effects";
export * from "./EffectsParams";
export * from "./hdrLoader";
export * from "./ViewLayerParams";
export * from "./ResolutionScale";
export * from "./ResolutionScaleParams";
export * from "./Texturing";
export * from "./TexturingParams";
export * from "./TickParams";
export * from "./SnapshotParams";
export * from "./SnapshotResult";
export * from "./PickResult";
export * from "./PickParams";
export * from "./MaterialPresets";
export * from "./SectionPlaneCaps";
export * from "./SectionPlaneCapsParams";
export * from "./BodyHatch";
export * from "./BodyHatchParams";
