/**
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # XGF - xeokit Graphics Format
 *
 * ---
 *
 * ### *Import and export SceneModels as xeokit's native binary [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) format*
 *
 * ---
 *
 * This package allows us to import and export xeokit {@link scene!SceneModel | SceneModels} as xeokit Geometry Format
 * ([XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf)), xeokit's
 * compact binary-encoded runtime asset delivery format for {@link scene!SceneModel | SceneModel} data.
 *
 * To import a [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) model into xeokit, use the {@link XGFLoader} function, which will load the file into
 * a {@link scene!SceneModel | SceneModel}. To export a [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) model, use the {@link XKFWriter} function, which will export a
 * {@link scene!SceneModel | SceneModel} to [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf).
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
 * On our Viewer, we will create a single {@link viewer!View | View} to draw it to a canvas element on the page. We will
 * also attach a {@link cameracontrol!CameraControl | CameraControl} to our View, allowing us to control its camera with mouse and touch input.
 *
 * Within the Scene, we will create a {@link scene!SceneModel | SceneModel} to hold a model. We will then use
 * {@link xgf!XGFLoader | XGFLoader} to load
 * a [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) file into our SceneModel.
 *
 * * [Run this example]()
 *
 * ````javascript
 * import {Scene} from "@xeokit/sdk/scene";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * import {XGFLoader, XKFWriter} from "@xeokit/sdk/xgf";
 *
 * const scene = new Scene();
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
 * fetch("model.xgf").then(response => {
 *
 *     response.arrayBuffer().then(fileData => {
 *
 *         XGFLoader.load({
 *             fileData,
 *             sceneModel
 *         }).then(() => {
 *
 *              sceneModel.build();
 *
 *         }).catch(err => {
 *
 *              sceneModel.destroy();
 *
 *              console.error(`Error loading XGF: ${err}`);
 *         });
 *
 *     }).catch(err => {
 *         console.error(`Error creating ArrayBuffer from fetch response: ${err}`);
 *     });
 *
 * }).catch(err => {
 *     console.error(`Error fetching XGF file: ${err}`);
 * });
 * ````
 *
 * Using {@link xgf!XKFWriter | XKFWriter} to export the {@link scene!SceneModel | SceneModel} back to
 * [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf):
 *
 * ````javascript
 * const arrayBuffer = XKFWriter.write({
 *     sceneModel
 * });
 * ````
 *
 * @module xgf
 */
export * from "./XGFLoader";
export * from "./XKFWriter";
export * from "./versions/v1/XGFData_v1";
//# sourceMappingURL=index.d.ts.map
