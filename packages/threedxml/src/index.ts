/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2F3dxml.svg)](https://badge.fury.io/js/%40xeokit%2F3dxml)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/threedxml/badge)](https://www.jsdelivr.com/package/npm/@xeokit/threedxml)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/example_3DXML.png"/>
 *
 * # xeokit 3DXML Importer
 *
 * ---
 *
 * ### *Import 3D CAD models from 3DXML format*
 *
 * ---
 *
 * The xeokit SDK allows us to import CAD models from [3DXML](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#3dxml), a proprietary 3D file
 * format developed by Dassault Systemes.
 *
 * To import a 3DXML model into xeokit, simply use the {@link load3DXML} function, which will load the file into both
 * a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNkk1vgkAQhv8KmVOboAH5EIjxxFFTI5em2cvKDnUbYMmyJKXG_95dEK0eTLks78zsMx87J8gFQ0ggL2nbppx-SlqRmtSMS8wVF7W12Rs9-K0sxxq3-kZpnUht6Y-z8RSHLx3fjiKXSBW-DaaX19F26HjJJsGwVVL0Rp4NfeKnVNEB_4zeSNGgVH2Gz_KNtj2W1HTRHnlz79ndKP8qcSxwIyjz0vftZkf1oNppCqtVYzQqlOv1aCp4iaadUbXXwV3oU6N39HKi37hFVw_PYLBD5EMFBBwCs9magEsg-5PlWVx6y35NOfke7oENFcqKcqaXZKiKgDpihQQS_cuwoF2pCOjqdCjtlMj6OodEyQ5t6BrdKF7WCpKClq22IuNKyO1l8cxhQ0NrSE7wDYm7jOdh6ERL1w9c14-9yIYeEi-M5l7sBK6_COPF0o_ONvwIoanOPAiDpfZ5QeiEXuR7A-5jcJo6zr-CjvAT?type=png)](https://mermaid.live/edit#pako:eNqNkk1vgkAQhv8KmVOboAH5EIjxxFFTI5em2cvKDnUbYMmyJKXG_95dEK0eTLks78zsMx87J8gFQ0ggL2nbppx-SlqRmtSMS8wVF7W12Rs9-K0sxxq3-kZpnUht6Y-z8RSHLx3fjiKXSBW-DaaX19F26HjJJsGwVVL0Rp4NfeKnVNEB_4zeSNGgVH2Gz_KNtj2W1HTRHnlz79ndKP8qcSxwIyjz0vftZkf1oNppCqtVYzQqlOv1aCp4iaadUbXXwV3oU6N39HKi37hFVw_PYLBD5EMFBBwCs9magEsg-5PlWVx6y35NOfke7oENFcqKcqaXZKiKgDpihQQS_cuwoF2pCOjqdCjtlMj6OodEyQ5t6BrdKF7WCpKClq22IuNKyO1l8cxhQ0NrSE7wDYm7jOdh6ERL1w9c14-9yIYeEi-M5l7sBK6_COPF0o_ONvwIoanOPAiDpfZ5QeiEXuR7A-5jcJo6zr-CjvAT)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/threedxml
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll import a 3DXML file into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and a {@link @xeokit/data!DataModel | DataModel}. The {@link @xeokit/core!SDKError | SDKError} class
 * is used to handle errors that may occur during the process:
 *
 * ````javascript
 * import { Scene } from "@xeokit/scene";
 * import { Data } from "@xeokit/data";
 * import { load3DXML } from "@xeokit/threedxml";
 *
 * const scene = new Scene();
 * const data = new Data();
 * const dataModel = data.createModel({ id: "myModel" });
 * const sceneModel = scene.createModel({ id: "myModel" });
 *
 * if (dataModel instanceof SDKError) {
 *      console.error("Error creating DataModel: " + dataModel.message);
 *
 * } else if (sceneModel instanceof SDKError) {
 *      console.error("Error creating SceneModel: " + dataModel.message);
 *
 * } else {
 *       fetch("./data/3dxml/3dpreview.3dxml")
 *         .then(response => response.blob())
 *         .then(fileData => {
 *
 *              load3DXML({fileData, dataModel, sceneModel}).then(() => {
 *
 *                  sceneModel.build().then(() => {
 *
 *                      dataModel.build().then(() => {
 *
 *                          // Done!
 *
 *                     }).catch(sdkError => console.error("Error building DataModel: " + sdkError.message));
 *                 }).catch(sdkError => console.error("Error building SceneModel: " + sdkError.message));
 *             }).catch(sdkError => console.error("Error parsing 3DXML file: " + sdkError.message));
 *         }).catch(errMsg => console.error("Error fetching 3DXML file: " + errMsg));
 * }
 * ````
 *
 * @module @xeokit/threedxml
 */
export * from "./load3DXML";
