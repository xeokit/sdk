/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_viewer_logo.png"/>
 *
 * # xeokit Viewer
 *
 * ---
 *
 * ***The SDK's browser-based 3D/2D scene viewer***
 *
 * ---
 *
 * The {@link Viewer | Viewer} is a tool for interactive 3D scene exploration, compatible with major browsers and mobile platforms. It
 * supports precise rendering with double-precision coordinates, multiple views with independent configurations, and integration of
 * semantic data models.
 *
 * Key features include dynamic slicing, object interaction, ambient occlusion, edge highlighting, BIM and BCF support, and
 * flexible rendering and lighting options, making it suitable for diverse technical applications.
 *
 * # Features
 *
 * - **Interactive Exploration**
 *   Use a {@link Viewer | Viewer} to explore a 3D {@link scene!Scene | Scene} interactively across all major browsers, including mobile platforms.
 *
 * - **Customizable Renderer**
 *   The Viewer supports a pluggable {@link Renderer | Renderer} strategy, ensuring compatibility with various browser graphics APIs. This documentation features the {@link webglrenderer!WebGLRenderer | WebGLRenderer}, which configures the Viewer to use WebGL for rendering.
 *
 * - **Scene Models**
 *   The Viewer is attached to a {@link scene!Scene | Scene} containing the geometry and materials of models. The Scene serves as a container for {@link scene!SceneModel | SceneModels}, {@link scene!SceneObject | SceneObjects}, {@link scene!SceneMesh | SceneMeshes}, and {@link scene!SceneGeometry | SceneGeometries}. It can be constructed programmatically or imported/exported in various file formats.
 *
 * - **High Precision**
 *   The Viewer enables accurate rendering of models that use large double-precision World coordinates, eliminating the need to center distant models to prevent rounding jitter during viewing.
 *
 * - **Multiple Views**
 *   The Viewer can manage multiple {@link View | Views}, each offering an independent perspective of the Scene within its own HTML canvas. Each View maintains unique camera positions, projection settings, lighting configurations, and object states (e.g., visibility, highlighting, X-ray, or colorization).
 *
 * - **View Layers**
 *   Objects in a View can be organized into {@link ViewLayer | ViewLayers}, grouping them by role. This feature simplifies updates such as toggling visibility, selection, highlighting, or slicing for specific object groups.
 *
 * - **Semantic Data Models**
 *   The Viewer can integrate semantic {@link data!Data | Data}, represented as an entity-relationship graph. This allows for programmatic creation and querying of data models, including {@link data!DataModel | DataModels}, {@link data!DataObject | DataObjects}, {@link data!PropertySet | PropertySets}, and {@link data!Relationship | Relationships}. Semantic data can be linked to SceneModels and SceneObjects using corresponding IDs.
 *
 * - **BCF Interoperability**
 *   For BIM models, use {@link bcf!saveBCFViewpoint | saveBCFViewpoint} and {@link bcf!loadBCFViewpoint | loadBCFViewpoint} to share Viewer snapshots encoded as {@link bcf!BCFViewpoint | BCFViewpoints} in the Building Collaboration Format (BCF). This open format facilitates data exchange and collaboration on 3D models.
 *
 * - **Custom Slicing Planes**
 *   Create unlimited {@link SectionPlane | SectionPlanes} in each View to slice through models and reveal internal structures. SectionPlanes can be adjusted dynamically through code or user interaction.
 *
 * - **Object Interaction**
 *   Dynamically highlight, select, colorize, or X-ray objects in a View. Highlights and selections add a glowing effect, colorized objects adopt temporary colors, and X-rayed objects appear translucent.
 *
 * - **Dynamic Resolution Scaling**
 *   Adjust the resolution of a View’s canvas dynamically, lowering it during camera movement and restoring it upon stopping to optimize performance.
 *
 * - **Ambient Shadows (SAO)**
 *   Apply scalable ambient occlusion effects ({@link SAO}) to enhance 3D visualization by darkening areas with limited ambient light. This adds depth and highlights spatial relationships.
 *
 * - **Edge Enhancement**
 *   Automatically highlight 3D triangle mesh edges with {@link Edges}, emphasizing shared edges and non-coplanar triangle boundaries.
 *
 * - **Dynamic Lighting**
 *   Add unlimited light sources such as {@link DirLight | DirLights}, {@link PointLight | PointLights}, and {@link AmbientLight | AmbientLights}, and adjust their positions programmatically.
 *
 * - **Configuration Management**
 *   Save and restore the runtime settings of a {@link Viewer | Viewer} using {@link Viewer.toParams | Viewer.toParams} and {@link Viewer.fromParams | Viewer.fromParams}. This allows sharing configurations between Viewer instances, facilitating issue reproduction and enabling control systems within applications.
 *
 * - **Object Picking**
 *   Pick objects in a View using 2D canvas coordinates or a 3D ray. Select entire ViewObjects or specific 3D points on their surfaces.
 *
 * - **Canvas Snapshots**
 *   Capture bitmap snapshots of a View's canvas, with adjustable resolution.
 *
 * - **Projection Options**
 *   Each View supports orthographic, perspective and custom projections.
 *
 *   **Render Modes**
 *   Each View allows us to define multiple custom rendering modes and configure specific effects for each mode. When a View
 *   is set to a particular mode, the associated effects for that mode are applied. For example, we can configure a
 *   View to apply enhanced edges and ambient shadows in {@link constants!QualityRender | QualityRender} mode, while
 *   enabling only resolution scaling in {@link constants!FastRender | FastRender} mode.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNVU1v4jAQ_SuRT7srQKRAgKjiQqXdA6iI7oe0ysVJpsWtY2cdhy2l_Pd1_JEmkK7KJWbemzdj541zRAlPAYUoobgobgh-EDiLWEoEJJJw5q22EdOY95PAXxDeMWKe-QlgKQgQJlAkwMAs94pZmGUiAEuoUj99NpGInZqKTi_BbI9tEo8fVXWngDMQ2Kwpedi5eGEa3FDMwIYoPoBoFV5VEVfZhO4aeW1kValXoVaDWsJ1SdKODv-UmBJ52OrjOMu-1cTz9D0pSEzBbYQqClhop5rQ23SBZ6EasOuEUy7Ii01MKMlzXOvkJHl6-4dxHDd6WepTdH3AATx7ZJw_mVWZWxnBH80RNdKbh-ZEcl54VkXZpfleb4jQZ-mYFeyoegstF2ytjTT7-hrHhRQ4kYtFg_ML4q-rFrG5t7KQPNvUfbuyGZaCPDd3UVm0RpXvaafhtBnWFVz7gwIWLWdoKc35rzWMljGBE4tLQlP3JwW1W3641L40jsIjZoYwQn6E-v2Ffm7rMewA78xUmkcNfLGAKfIurPdnUbN-V-G8tMKrUGivgmp9AZrcsD6wt5imtLZgucosuYACmCw8wrxv39er-uborKGnN3QXQx2J0HAw-EA7rbNc2pvoopDze-jupwtGc34iZoWa2hvVX16R9t34rZA73omcuz9i9Zxcv_b7Z6MTeiTLKWTVCXYxNz8-RF3z5OkdYvO-WXKm3F2PiP4waCO34NbL8M3LQD2kGBkmqfo26fQIyZ2qEaFQLVO4xyVVPlFqiopLye8OLEHhPaYF9FCZp2ru7OesjkJKJBdr-8GrHj2UY4bCI3pGoT-dD4JgOJv644nvj-ejWQ8dUDgKZoPRfDjxx1fB_Go6np166IVzpTocTILJVGGjSTAMRrPxSMv91qAUJZz-AZsUb1U?type=png)](https://mermaid.live/edit#pako:eNqNVU1v4jAQ_SuRT7srQKRAgKjiQqXdA6iI7oe0ysVJpsWtY2cdhy2l_Pd1_JEmkK7KJWbemzdj541zRAlPAYUoobgobgh-EDiLWEoEJJJw5q22EdOY95PAXxDeMWKe-QlgKQgQJlAkwMAs94pZmGUiAEuoUj99NpGInZqKTi_BbI9tEo8fVXWngDMQ2Kwpedi5eGEa3FDMwIYoPoBoFV5VEVfZhO4aeW1kValXoVaDWsJ1SdKODv-UmBJ52OrjOMu-1cTz9D0pSEzBbYQqClhop5rQ23SBZ6EasOuEUy7Ii01MKMlzXOvkJHl6-4dxHDd6WepTdH3AATx7ZJw_mVWZWxnBH80RNdKbh-ZEcl54VkXZpfleb4jQZ-mYFeyoegstF2ytjTT7-hrHhRQ4kYtFg_ML4q-rFrG5t7KQPNvUfbuyGZaCPDd3UVm0RpXvaafhtBnWFVz7gwIWLWdoKc35rzWMljGBE4tLQlP3JwW1W3641L40jsIjZoYwQn6E-v2Ffm7rMewA78xUmkcNfLGAKfIurPdnUbN-V-G8tMKrUGivgmp9AZrcsD6wt5imtLZgucosuYACmCw8wrxv39er-uborKGnN3QXQx2J0HAw-EA7rbNc2pvoopDze-jupwtGc34iZoWa2hvVX16R9t34rZA73omcuz9i9Zxcv_b7Z6MTeiTLKWTVCXYxNz8-RF3z5OkdYvO-WXKm3F2PiP4waCO34NbL8M3LQD2kGBkmqfo26fQIyZ2qEaFQLVO4xyVVPlFqiopLye8OLEHhPaYF9FCZp2ru7OesjkJKJBdr-8GrHj2UY4bCI3pGoT-dD4JgOJv644nvj-ejWQ8dUDgKZoPRfDjxx1fB_Go6np166IVzpTocTILJVGGjSTAMRrPxSMv91qAUJZz-AZsUb1U)
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * <br>
 *
 * # Usage
 *
 *  In JavaScript, import the modules we'll need:
 *
 * ````javascript
 * import {Scene} from "@xeokit/sdk/scene";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {KTX2TextureTranscoder} from "@xeokit/sdk/ktx2";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/sdk/constants";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * import {loadDotBIM} from "@xeokit/sdk/dotbim";
 * import {saveBCFViewpoint, loadBCFViewpoint} from "@xeokit/sdk/bcf";
 *
 * import {
 *     CustomProjectionType,
 *     FrustumProjectionType,
 *     OrthoProjectionType,
 *     PerspectiveProjectionType,
 *     LinearEncoding,
 *     LinearFilter,
 *     TrianglesPrimitive
 * } from "@xeokit/sdk/constants";
 * ````
 *
 * <br>
 *
 * ## Creating a Scene
 *
 * Create a {@link scene!Scene | Scene} to hold our model geometry and materials.
 *
 * ````javascript
 * const scene = new Scene();
 * ````
 *
 * <br>
 *
 * ## Creating a Viewer
 *
 * Create a {@link Viewer | Viewer} to view our Scene.
 *
 * Our Viewer gets a {@link webglrenderer!WebGLRenderer | WebGLRenderer}, which adapts it to use the browser's WebGL graphics API.
 * We'll also equip our WebGLRenderer with a {@link ktx2!KTX2TextureTranscoder | KTX2TextureTranscoder}, in case we need to view compressed textures.
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderer: new WebGLRenderer({
 *          textureTranscoder: new KTX2TextureTranscoder({  // Optional, this is the default
 *              transcoderPath: "./../dist/basis/" // Optional, defaults to CDN
 *          })
 *      })
 * });
 * ````
 *
 * <br>
 *
 * ## Creating a View
 *
 * A Viewer draws its output to one or more {@link View | Views}. Each View is an independent and interactive view of the Scene,
 * with its own canvas, {@link Camera | Camera}, object visual states etc.
 *
 * Within our Viewer, we'll create a {@link View | View} and arrange its Camera:
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     elementId: "myView1"
 * });
 * ````
 *
 * <br>
 *
 * ## Positioning the Camera
 *
 * Each {@link View} has a {@link Camera} which controls the viewpoint and projection.
 *
 * We can dynamically move the Camera:
 *
 * ````javascript
 * view1.camera.eye = [-3.93, 2.85, 27.01];
 * view1.camera.look = [4.40, 3.72, 8.89];
 * view1.camera.up = [-0.01, 0.99, 0.03];
 * ````
 *
 * <br>
 *
 * ## Configuring the Camera Projection
 *
 * Each {@link Camera} has a {@link PerspectiveProjection}, a {@link FrustumProjection},
 * an {@link OrthoProjection}, and a {@link CustomProjection}.
 *
 * These can be dynamically configured:
 *
 * ````javascript
 * view1.perspectiveProjection.fov = 60.0;
 * view1.frustumProjection.fov = 60.0;
 * view1.orthoProjection.scale = 1.0;
 * view1.customProjection.matrix = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 * ````
 *
 * Switch a Camera between projection types like this:
 *
 * ````javascript
 * view1.projectionType = OrthoProjectionType;
 * view1.projectionType = PerspectiveProjectionType;
 * ````
 *
 * <br>
 *
 * ## Adding a CameraControl
 *
 * Add a {@link cameracontrol!CameraControl | CameraControl} to the View, to control its Camera with mouse and
 * touch input:
 *
 * ````javascript
 * const myCameraControl = new CameraControl({
 *      view: view1
 * });
 * ````
 *
 * <br>
 *
 * ## Configuring the 3D World Coordinate Axis
 *
 * Different domains use varying 3D world coordinate conventions. For instance, BIM applications often use the +Z axis
 * as "up," while others use +Y.
 *
 * Each {@link View} allows dynamic configuration of its {@link Camera} to align with these World-space coordinate
 * systems. This will affect the way that {@link cameracontrol!CameraControl} behaves, if attached.
 *
 * To set the +Y axis as "up," +X as "right," and -Z as "forward" (common in some modeling software):
 *
 * ````javascript
 * view1.camera.worldAxis = [
 *     1, 0, 0, // Right
 *     0, 1, 0, // Up
 *     0, 0,-1  // Forward
 * ];
 * ````
 *
 * Here, the ground lies in the X-Z plane, and vertical movement aligns with the Y axis.
 *
 * To set the +Z axis as "up," +X as "right," and -Y as "forward" (common in most CAD and BIM viewers):
 *
 * ````javascript
 * view1.camera.worldAxis = [
 *     1, 0, 0, // Right
 *     0, 0, 1, // Up
 *     0,-1, 0  // Forward
 * ];
 * ````
 *
 * In this configuration, the ground lies in the X-Y plane, and vertical movement aligns with the Z axis.
 *
 * <br>
 *
 * ## Creating a SceneModel
 *
 * Our {@link scene!Scene | Scene} is a container for model geometry and materials.
 *
 * Within the Scene, we'll create a {@link scene!SceneModel | SceneModel} that contains three
 * textured {@link scene!SceneModel | SceneObjects}. As soon as we've
 * called {@link scene!SceneModel.build | SceneModel.build}, three
 * new objects will appear in the View's canvas to represent them.
 *
 * ````javascript
 * const sceneModel = scene.createModel();
 *
 * sceneModel.createGeometry({
 *      id: "myGeometry",
 *      primitive: TrianglesPrimitive,
 *      positions: [202, 202, 202, 200, 202, 202, ...],
 *      indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, ...]
 * });
 *
 * sceneModel.createTexture({
 *      id: "myColorTexture",
 *      src: "myTexture",
 *      encoding: LinearEncoding, // Demo some texture configs
 *      magFilter: LinearFilter,
 *      minFilter: LinearFilter
 * });
 *
 * sceneModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture"
 * });
 *
 * sceneModel.createLayerMesh({
 *     id: "myMesh1",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createLayerMesh({
 *     id: "myMesh2",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createLayerMesh({
 *     id: "myMesh3",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh1"]
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh2"]
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject3",
 *     meshIds: ["myMesh3"]
 * });
 *
 * sceneModel.build();
 * ````
 *
 * <br>
 *
 * ### Reducing Memory Usage
 *
 * When building a SceneModel, the Viewer loads all geometry data into the {@link scene!Renderer | Renderer} (e.g., a {@link webglrenderer!WebGLRenderer | WebGLRenderer}).
 *
 * By default, the SceneModel retains this geometry data in {@link scene!SceneGeometry | SceneGeometry} components for tasks like runtime querying and file saving. If this data isn't needed, you can configure the SceneModel to discard it, reducing memory usage.
 *
 * ````javascript
 * const sceneModel = scene.createModel({
 *  retained: false // Default is true
 * });
 *
 * // ...build the SceneModel...
 *
 * sceneModel.build(); // Discards geometry
 *
 * const sceneObject = sceneModel.objects["object1"]; // SceneObject
 * const sceneMesh = sceneModel.meshes["myMesh"]; // SceneMesh
 * const geometry = sceneMesh.geometry; // null
 *
 * // geometry is null
 * ````
 *
 * After calling `SceneModel.build`, the `geometry` property of each contained `SceneObject` becomes `null`. Normally, this property would hold a `SceneGeometry` instance if geometry were retained.
 *
 * The geometry remains fully viewable and functional but is no longer accessible from JavaScript memory, as it is stored solely on the GPU.
 *
 * <br>
 *
 * ## Showing and Hiding Objects
 *
 * Having created our Scene, Viewer, View and SceneModel, we now have three objects showing in our View.
 *
 * The objects are represented by {@link ViewObject | ViewObjects}, which are stored in {@link View.objects | View.objects}.
 *
 * Use {@link View.setObjectsVisible | View.setObjectsVisible} to hide one of the objects:
 *
 * ````javascript
 * view1.setObjectsVisible(["myObject1"], false);
 * ````
 *
 * We can also set {@link ViewObject.visible | ViewObject.visible} directly:
 *
 * ````javascript
 * view1.objects["myObject1"].visible = false;
 * ````
 *
 * Show the object again:
 *
 * ````javascript
 * view1.objects["myObject1"].visible = true;
 * ````
 *
 * Get the IDs of all visible ViewObjects:
 *
 * ````javascript
 * const visibleObjectIds = view1.visibleObjectIds;
 * ````
 *
 * <br>
 *
 * ## Highlighting, Selecting and X-Raying Objects
 *
 * The methods for highlighting, selecting and X-raying objects work the same as when hiding and
 * showing them. Colorize is a little bit different, so we'll look at it separately.
 *
 * ````javascript
 * view1.setObjectsHighlighted(["myObject1"], true);
 * view1.setObjectsSelected(["myObject2"], true);
 * view1.setObjectsXRayed(["myObject3"], true);
 * ````
 *
 * We can also set the  {@link ViewObject.highlighted | ViewObject.highlighted}, {@link ViewObject.selected | ViewObject.selected}
 * and {@link ViewObject.xrayed | ViewObject.xrayed} properties directly:
 *
 * ````javascript
 * view1.objects["myObject1"].highlighted = true;
 * view1.objects["myObject2"].selected = true;
 * view1.objects["myObject3"].xrayed = true;
 * ````
 *
 * We can configure the appearance of these effects via the {@link EmphasisMaterial | EmphasisMaterials} components at
 * {@link View.highlightMaterial | View.highlightMaterial}, {@link View.selectedMaterial | View.selectedMaterial} and
 * {@link View.xrayMaterial | View.xrayMaterial}.
 *
 * <br>
 *
 * ## Colorizing Objects
 *
 * To colorize an object, we set an RGB color value on it.
 *
 * Let's colorize the first object in our {@link View}, setting it red:
 *
 * ````javascript
 * view1.setObjectsColorized(["myObject1"], [1,0,0]);
 * ````
 *
 * We can also set the {@link ViewObject.colorize | ViewObject.colorize} property directly:
 *
 * ````javascript
 * view1.objects["myObject1"].colorize = [1,0,0];
 * ````
 *
 * To un-colorize it, just set the property back to null:
 *
 * ````javascript
 * view1.objects["myObject1"].colorize = null;
 * ````
 *
 * Use {@link View.setObjectsColorized | View.setObjectsColorized} to batch-colorize and un-colorize objects:
 *
 * ````javascript
 * view1.setObjectsColorized(["myObject1", "myObject2"], [1,0,0]);
 * view1.setObjectsColorized(view1.colorizedObjectIds, null);
 * ````
 *
 * The {@link View.colorizedObjectIds | View.colorizedObjectIds} property contains the IDs of all ViewObjects currently
 * colorized in the View:
 *
 * ````javascript
 * const colorizedObjectIds = view1.colorizedObjectIds;
 * ````
 *
 * <br>
 *
 * ## Object Boundary Queries
 *
 * A View monitors the 3D world-space boundaries of objects, allowing efficient runtime queries for tasks such as
 * collision detection, visibility culling, and camera navigation.
 *
 * You can access an object's boundary at any time:
 *
 * ````javascript
 * const viewObject1 = view1.objects["myObject1"]; // ViewObject
 *
 * const aabb1 = viewObject1.aabb; // [xmin, ymin, zmin, xmax, ymax, zmax]
 * ````
 *
 * <br>
 *
 * ## Slicing Objects
 *
 * Each View can include an unlimited number of {@link SectionPlane | SectionPlanes}, allowing you to slice through models and
 * reveal internal structures. SectionPlanes can be adjusted dynamically using code or the Scene allows us through user interaction.
 *
 * Here’s how to create a SectionPlane that slices away half of the Scene:
 *
 * ```javascript
 * view1.createSectionPlane({
 *     id: "sectionPlane1",
 *     pos: [0, 0, 0],
 *     dir: [-1, -1, -1]
 * });
 * ```
 *
 * SectionPlanes can also be animated dynamically:
 *
 * ```javascript
 * const sectionPlane1 = view1.sectionPlanes["sectionPlane1"];
 *
 * sectionPlane1.dir = [-1, -1, 1];
 * sectionPlane1.pos = [1, 0, 0];
 * ```
 *
 * To remove SectionPlanes, you can destroy them individually:
 *
 * ```javascript
 * sectionPlane1.destroy();
 * ```
 *
 * Or clear all SectionPlanes at once:
 *
 * ```javascript
 * view1.clearSectionPlanes();
 * ```
 *
 * If specific objects need to remain unaffected by SectionPlanes, you can make them unclippable. For example:
 *
 * ```javascript
 * view1.setObjectsClippable(["myObject1"], false);
 * ```
 *
 * Alternatively, you can directly set the {@link ViewObject.clippable | ViewObject.clippable} property:
 *
 * ```javascript
 * view1.objects["myObject1"].clippable = false;
 * ```
 *
 * <br>
 *
 * ## Customize Lighting
 *
 * Enhance the lighting of a {@link View} by adding custom {@link DirLight | DirLights}, {@link PointLight | PointLights},
 * and {@link AmbientLight | AmbientLights}.
 *
 * Here's how to set up different types of lights:
 *
 * ```javascript
 * view1.clearLights();
 *
 * view1.createDirLight({ // DirLight
 *   id: "dirLight1",
 *   dir: [-1, -1, -1],
 *   color: [0.9, 0.9, 0.9],
 *   intensity: 0.9
 * });
 *
 * view1.createPointLight({ // PointLight
 *   id: "pointLight1",
 *   pos: [-100, 10, -100],
 *   color: [0.9, 0.9, 1.0],
 *   intensity: 1.0,
 *   constantAttenuation: 0.8,
 *   linearAttenuation: 0.9,
 *   quadraticAttenuation: 0.9
 * });
 *
 * view1.createAmbientLight({ // AmbientLight
 *   id: "ambientLight1",
 *   color: [0.5, 0.5, 0.6],
 *   intensity: 0.7
 * });
 * ```
 *
 * You can also dynamically animate the properties of these lights:
 *
 * ```javascript
 * const dirLight1 = view1.lights["dirLight1"];
 * const pointLight1 = view1.lights["pointLight1"];
 * const ambientLight1 = view1.lights["ambientLight1"];
 *
 * dirLight1.dir = [1, -1, 1];
 * pointLight1.pos = [1, 0, 0];
 * ambientLight1.intensity = 0.4;
 * ```
 *
 * To remove individual lights:
 *
 * ```javascript
 * dirLight1.destroy();
 * pointLight1.destroy();
 * ambientLight1.destroy();
 * ```
 *
 * Or clear all lights at once:
 *
 * ```javascript
 * view1.clearLights();
 * ```
 *
 *  <br>
 *
 * ## Creating Additional Views
 *
 * A {@link Viewer} can have an unlimited number of {@link View}, each providing an independent view of the Scene in a separate
 * HTML canvas. Each View can have a completely different viewpoint, projection, and configuration of which objects
 * are visible, x-rayed, highlighted etc.
 *
 * Let's create a second View, with a separate canvas, that shows the other object highlighted instead:
 *
 * ```` javascript
 * const view2 = myViewer.createView({
 *      id: "myView2",
 *      elementId: "myView2"
 * });
 *
 * view2.camera.eye = [-3.933, 2.855, 27.018];
 * view2.camera.look = [4.400, 3.724, 8.899];
 * view2.camera.up = [-0.018, 0.999, 0.039];
 *
 * const myCameraControl2 = new CameraControl({
 *      view: view2
 * });
 *
 * view2.objects["myObject1"].highlighted = true;
 * ````
 *
 * To show an independent view of {@link scene!SceneModel | SceneObjects}, a View
 * proxies them with {@link ViewObject | ViewObjects}, which represent and control their appearance within the View's canvas.
 *
 * <br>
 *
 * ## Creating ViewLayers
 *
 * A {@link ViewLayer} is a layer of {@link ViewObject | ViewObjects} within a {@link View}.
 *
 * ViewLayers allow users to group and segregate ViewObjects based on their roles or aspects in a scene, simplifying
 * interaction and focusing operations
 * on specific object groups.
 *
 * ViewLayers group ViewObjects based on the {@link scene!SceneObject.layerId | layerId} of the
 * corresponding {@link scene!SceneObject | SceneObject}.
 *
 * Let's add a ViewLayer to our {@link View}, to hold environmental objects, like sky boxes, that are not part of any model.
 *
 * ````javascript
 * const environmentViewLayer = view.createLayer({
 *     id: "myEnvironmentViewLayer"
 * });
 * ````
 *
 * Now we'll create a SceneModel for our skybox in that ViewLayer:
 *
 * ````javascript
 * const skyboxSceneModel = myVScene.createModel({
 *      id: "mySkyBox",
 *      layerId: "myEnvironmentViewLayer"
 * });
 *
 * skyboxSceneModel.createObject({
 *      id: "skyBox",
 *      //...
 * });
 *
 * skyboxSceneModel.build();
 * ````
 *
 * Hide all objects in our new ViewLayer:
 *
 * ````javascript
 * environmentViewLayer.setObjectsVisible(environmentLayer.objectIds, false);
 * ````
 *
 * <br>
 *
 * ## Loading SceneModels from Files
 *
 * We can view additional models by creating SceneModels and loading files into them.
 *
 * Lets create a new SceneModel in the Scene and then use {@link dotbim!loadDotBIM} to
 * load a house model into it from .BIM format.
 *
 * ````javascript
 * const sceneModel2 = scene.createModel({
 *     id: "houseModel"
 * });
 *
 * fetch(`model.bim`)
 *     .then(response => {
 *         response
 *             .json()
 *             .then(fileData => {
 *
 *                  loadDotBIM({
 *                     fileData,
 *                     sceneModel2
 *                 })
 *                 .then(()=>{
 *                     sceneModel2.build();
 *                 })
 *                 .catch(err => {
 *                     console.error(err);
 *                 });
 *              }).catch(err => {
 *                  console.error(err);
 *              });
 *     }).catch(err => {
 *         console.error(err);
 *     });
 * ````
 *
 * <br>
 *
 * ## Saving SceneModels to Files
 *
 * We can save the SceneModels in our Scene to a variety of formats.
 *
 * Lets use {@link dotbim!saveDotBIM} to save our house model back to a .BIM file.
 *
 * ````javascript
 * const xktFileData = saveXKT({
 *      sceneModel
 * });
 * ````
 *
 * <br>
 *
 * ## Capturing Canvas Snapshots
 *
 * Let's use {!link View.getSnapshot | View.getSnapshot} to capture a snapshot image of the
 * canvas to a {@link SnapshotResult}, while including UI elements ({@link treeview!TreeView | TreeView} etc) in the snapshot.
 *
 * ````javascript
 * const snapshotResult = view.getSnapshot({
 *     includeGizmos: true,
 *     height: 100,
 *     width: 150
 * });
 *
 * const imageData = snapshotResult.imageData;
 * ````
 *
 * <br>
 *
 * ## Rendering Modes
 *
 * A View allows us to define multiple rendering modes and configure specific effects for each mode. When a View is set
 * to a particular mode, the associated effects for that mode are applied.
 *
 * For example, we can configure a View to apply enhanced edges and ambient shadows
 * in {@link constants!QualityRender | QualityRender} mode, while enabling only resolution
 * scaling in {@link constants!FastRender | FastRender} mode.
 *
 * ```javascript
 * import { FastRender, QualityRender } from "@xeokit/sdk/constants";
 *
 * myView.edges.renderModes = [QualityRender];
 * myView.sao.renderModes = [QualityRender];
 * myView.resolutionScale.renderModes = [FastRender];
 * ```
 *
 * Initially, we'll set the View to FastRender mode:
 *
 * ```javascript
 * myView.renderMode = FastRender;
 * ```
 *
 * To render the View with full resolution, edge enhancements, and ambient shadows, simply switch to QualityRender mode:
 *
 * ```javascript
 * myView.renderMode = QualityRender;
 * ```
 *
 * Switch back to FastRender mode to enable resolution scaling and disable edges and ambient shadows for
 * smoother interaction:
 *
 * ```javascript
 * myView.renderMode = FastRender;
 * ```
 *
 * This example uses the pre-defined constants `QualityRender` and `FastRender` to demonstrate rendering modes. However,
 * the number of rendering modes is not limited—you can define your own constants to create additional modes as needed.
 *
 * <br>
 *
 * ## Picking
 *
 * TODO
 *
 * ## Tick Events
 *
 * <br>
 *
 * ## Saving and Loading BCF Viewpoints
 *
 * Building Collaboration Format (BCF) is a file format designed to facilitate communication and collaboration in Building
 * Information Modeling (BIM) projects. It enables the exchange of issues and viewpoints between various tools and platforms.
 *
 * Using {@link bcf!saveBCFViewpoint | saveBCFViewpoint}, we can capture the current visual state of a View and save it
 * as a {@link bcf!BCFViewpoint | BCFViewpoint}, which can be easily serialized to JSON.
 *
 * In this example, we’ll exclude the states of the ViewObjects in the skybox or environment ViewLayer when saving the viewpoint:
 *
 * ```javascript
 * const bcfViewpoint = saveBCFViewpoint({
 *    view,
 *    excludeViewLayerIds: ["myEnvironmentViewLayer"]
 * });
 * ```
 *
 * To reload the saved BCF viewpoint back into the View, we use {@link bcf!loadBCFViewpoint | loadBCFViewpoint}. Even
 * though the skybox or environment ViewObject states weren’t saved, this example demonstrates how to filter them out
 * to ensure they are not loaded:
 *
 * ```javascript
 * loadBCFViewpoint({
 *    bcfViewpoint,
 *    view,
 *    excludeViewLayerIds: ["myEnvironmentViewLayer"]
 * });
 * ```
 * <br>
 *
 * ## Saving and Loading Viewer Configurations
 *
 * In xeokit, everything is data-driven, including the Viewer's configuration.
 *
 * You can use {@link viewer!Viewer.toParams | Viewer.toParams} to serialize the current configuration of a Viewer
 * into a {@link ViewerParams} object, which can then be saved as JSON.
 *
 * ````javascript
 * const viewerParams = viewer.toParams();
 * ````
 *
 * Now let's create a second Viewer and configure it using {@link viewer!Viewer.fromParams | Viewer.fromParams} with the
 * previously serialized ViewerParams. This allows the second Viewer to replicate the exact configuration of the first,
 * including copies of Views, Cameras, SectionPlanes, HighlightMaterials, Lights, and other components.
 *
 * ````javascript
 * const viewer2 = new Viewer({
 *     id: "myViewer2",
 *     scene: new Scene(), // Must have own Scene
 *     renderer: new WebGLRenderer() // Must have own WebGLRenderer
 * });
 *
 * viewer2.fromParams(viewerParams);
 * ````
 *
 * A ViewerParams object contains parameter objects for various components within a Viewer, such as Views, Lights, Cameras, ViewLayers, and more. If the components do
 * not already exist, `Viewer.fromParams` will create and configure them. If the components already exist, then `Viewer.fromParams` will simply
 * update their configuration.
 *
 * Individual components can also be configured directly using their respective parameter types. For example, to copy a
 * {@link ViewParams} object between two Views:
 *
 * ````javascript
 * const viewParams = viewer.views["myView"].toParams();
 *
 * viewer2.views["myView"].fromParams(viewParams);
 * ````
 *
 * Since all fields in a parameter object are optional, the `fromParams()` methods will only configure the relevant component (and its child components) based on the fields present in the parameter object.
 *
 * To go deeper, let's copy a {@link CameraParams} object between the Cameras of two Views:
 *
 * ````javascript
 * const cameraParams = viewer.views["myView"].camera.toParams();
 *
 * viewer2.views["myView"].camera.fromParams(cameraParams);
 * ````
 *
 * Delving further, let's exchange a {@link PerspectiveProjectionParams} object between the {@link PerspectiveProjection | PerspectiveProjections} of two Cameras:
 *
 * ````javascript
 * const perspectiveProjectionParams = viewer.views["myView"].camera.perspective.toParams();
 *
 * viewer2.views["myView"].camera.perspective.fromParams(perspectiveProjectionParams);
 * ````
 *
 * We can even transfer configurations for rendering effects, such as X-Ray mode:
 *
 * ````javascript
 * const xrayMaterialParams = viewer.views["myView"].xrayMaterial.toParams();
 *
 * viewer2.views["myView"].xrayMaterial.fromParams(xrayMaterialParams);
 * ````
 *
 * @module viewer
 */
export * from "./Viewer";
export * from "./ViewerParams";
export * from "./ViewParams";
export * from "./Renderer";
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
export * from "./scheduler";
export * from "./AmbientLight";
export * from "./AmbientLightParams";
export * from "./DirLight";
export * from "./DirLightParams";
export * from "./PointLight";
export * from "./PointLightParams";
export * from "./EmphasisMaterial";
export * from "./EmphasisMaterialParams";
export * from "./Edges";
export * from "./EdgesParams";
export * from "./PointsMaterial";
export * from "./PointsMaterialParams";
export * from "./LinesMaterial";
export * from "./Metriqs";
export * from "./View";
export * from "./ViewParams";
export * from "./ViewLayer";
export * from "./ViewLayerParams";
export * from "./ViewObject";
export * from "./SectionPlane";
export * from "./SectionPlaneParams";
export * from "./SAO";
export * from "./SAOParams";
export * from "./PickParams";
export * from "./PickResult";
export * from "./ViewLayerParams";
export * from "./ResolutionScale";
export * from "./ResolutionScaleParams";
export * from "./Texturing";
export * from "./TickParams";
export * from "./SnapshotParams";
export * from "./SnapshotResult";
