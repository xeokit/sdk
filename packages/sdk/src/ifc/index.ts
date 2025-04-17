/**
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # IFC - Industry Foundation Classes
 *
 * ---
 *
 * ### *Import and export SceneModels and DataModels as IFC*
 *
 * ---
 *
 * This package allows us to import and export xeokit {@link scene!SceneModel | SceneModels} as
 * IFC (Industry Foundation Classes), an open, global standard file format used for exchanging
 * Building Information Modeling (BIM) data between different software applications in the
 * Architecture, Engineering, and Construction (AEC) industry.
 *
 * To import an IFC model into xeokit, use {@link ifc!IFCLoader | IFCLoader}, which will load the file into
 * a {@link scene!SceneModel | SceneModel} and a {@link data!DataModel | DataModel}. To export an IFC model,
 * use the {@link ifc!IFCExporter | IFCExporter}, which will export a {@link scene!SceneModel | SceneModel} and
 * a {@link data!DataModel | DataModel} to IFC.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNkk1Lw0AQhv9KmJNCWvLRZNOl9FT00qIYBJG9bLMTjSTZkt2ItfS_u_mqCaKYy-ad2XnmHXZOkEiBQCHJuVKbjL9UvGAlK0VWYaIzWVrbh0a3eStOsMSdqcitEyst82WiO-X-zdxXnUgq5Brv2tDVdRfb11kuBiFQ6UoeG3lu6AN_K7l4ur2558aFGlqsVodGo8Zqve5CaZbjhmveKXVx1eM6WN7BvjFpXbYjNZTRvZi_43-ajttMAKoD_NFoMhcDh8FstmbgMohH0N7wkJoUUetRobIuplSDnTj_Fdvbu6TGRT-wYEOBVcEzYZaiHYiBfsUCGVDzKzDlda4ZmMHMVV5rGR_LBKiuarShPgjz8P0aAU15rkwURaZltesXrTlsOPAS6Ak-gHqOPw-jMCBuuAyI5wQ2HIEunGgekQXxfOJFhPjB2YZPKQ3UmQeOT4i7DB0T9j23hT23ucbF-Qsqh-4S?type=png)](https://mermaid.live/edit#pako:eNqNkk1Lw0AQhv9KmJNCWvLRZNOl9FT00qIYBJG9bLMTjSTZkt2ItfS_u_mqCaKYy-ad2XnmHXZOkEiBQCHJuVKbjL9UvGAlK0VWYaIzWVrbh0a3eStOsMSdqcitEyst82WiO-X-zdxXnUgq5Brv2tDVdRfb11kuBiFQ6UoeG3lu6AN_K7l4ur2558aFGlqsVodGo8Zqve5CaZbjhmveKXVx1eM6WN7BvjFpXbYjNZTRvZi_43-ajttMAKoD_NFoMhcDh8FstmbgMohH0N7wkJoUUetRobIuplSDnTj_Fdvbu6TGRT-wYEOBVcEzYZaiHYiBfsUCGVDzKzDlda4ZmMHMVV5rGR_LBKiuarShPgjz8P0aAU15rkwURaZltesXrTlsOPAS6Ak-gHqOPw-jMCBuuAyI5wQ2HIEunGgekQXxfOJFhPjB2YZPKQ3UmQeOT4i7DB0T9j23hT23ucbF-Qsqh-4S)
 *
 * <br>
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * In the example below, we will create a {@link viewer!Viewer | Viewer} with
 * a {@link webglrenderer!WebGLRenderer | WebGLRenderer}  and a {@link scene!Scene | Scene}, which holds model geometry and materials.
 *
 * We'll also create a {@link data!Data | Data}, which holds model semantic data.
 *
 * On our Viewer, we will create a single {@link viewer!View | View} to render it to a canvas element on the page. We will
 * also attach a {@link cameracontrol!CameraControl | CameraControl} to our View, allowing us to control its camera with mouse
 * and touch input.
 *
 * Within the Scene, we will create a {@link scene!SceneModel | SceneModel} to hold model geometry and a {@link scene!SceneModel | SceneModel}
 * to hold semantic data. We will then use
 * {@link ifc!IFCLoader | IFCLoader} to load an `IFC` file into the SceneModel and DataModel.
 *
 * ````javascript
 * import {Scene} from "@xeokit/sdk/scene";
 * import {Data} from "@xeokit/sdk/data";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * import {IFCLoader, IFCExporter} from "@xeokit/sdk/ifc";
 *
 * const ifcLoader = new IFCLoader();
 *
 * const scene = new Scene();
 *
 * const data = new Data();
 *
 * const renderer = new WebGLRenderer({});
 *
 * const viewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderer
 * });

 * const view = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas" // << Ensure that this HTMLElement exists in the page
 * });
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * const dataModel = data.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("model.ifc").then(response => {
 *
 *     response.arrayBuffer().then(fileData => {
 *
 *         ifcLoader.load({
 *              fileData,
 *              sceneModel,
 *              dataModel
 *
 *         }).then(() => {
 *              sceneModel.build();
 *              dataModel.build();
 *
 *         }).catch(err => {
 *              sceneModel.destroy();
 *              dataModel.destroy();
 *              console.error(`Error loading IFC: ${err}`);
 *         });
 *
 *     }).catch(err => {
 *         console.error(`Error creating ArrayBuffer from fetch response: ${err}`);
 *     });
 *
 * }).catch(err => {
 *     console.error(`Error fetching IFC file: ${err}`);
 * });
 * ````
 *
 * Using {@link ifc!IFCExporter | IFCExporter} to export the {@link scene!SceneModel | SceneModel} and
 * {@link scene!DataModel | DataModel} back to `IFC`:
 *
 * ````javascript
 *
 * const ifcExporter = new IFCExporter();
 *
 * ifcExporter.export({
 *      sceneModel,
 *      dataModel
 * }).then((arrayBuffer)=>{
 *      //
 * }).catch(err => {
 *      console.error(`Error writing IFC: ${err}`);
 * });
 * ````
 *
 * @module ifc
 */
export * from "./IFCLoader";
export * from "./IFCExporter";
