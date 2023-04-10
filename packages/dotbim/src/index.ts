/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdotbim.svg)](https://badge.fury.io/js/%40xeokit%2Fdotbim)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/dotbim/badge)](https://www.jsdelivr.com/package/npm/@xeokit/dotbim)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; width: 180px;" src="media://images/dotbim-logo.png"/>
 *
 * # xeokit .BIM Importer
 *
 * The xeokit SDK allows us to import 3D models from [.BIM](/docs/pages/GLOSSARY.html#dotbim), a JSON-based
 * file format specifically designed for lightweight, user-friendly, and human-readable storage and sharing of 3D BIM models.
 *
 * .BIM is an open-source and minimalist file format for BIM that's built to be easy to read and write. Essentially, .BIM
 * is a transfer format that contains triangulated meshes with a dictionary of information attached to them.
 *
 * To import a .BIM model into xeokit, simply use the {@link loadDotBIM} function, which will load the file into both
 * a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUk1vgkAQ_StkTm2CRpDvGA-GSxNNjdyavazsUGmAJbtLUmr8711ApHow5bLMm9n33szOGVLOECJICyplnNNPQUtSkYrlAlOV88rYHrq4zxtJihXu9I3COJPK0F_OhpMfv3S9HIJUIFX43kMvrwN2bPKCjQFDqQRvu_DSsY_8MVW0p3_GXgteo1Btgs_0BuyABe26kKe8vs_sJ5Z_WRwMbjllMVebt92e6knJcQyrVd3FqFCs1wNEhaDtpskyFAMgb8O7KozN3ikUN4WJO2uq_i066r700QaBBYHZbE3AIpD80XlaGE8GJtUx-XgTTChRlDRnelt6ZwTUCUskEOlfhhltCkVAO9SltFE8aasUIiUaNKGpdbd43S-IMlpIjSLLFRe76wZ2hwk1rSA6wzdEtmfNLct3Lc8OlqHnha4JrYbtuRP6nuuElm97wdK9mPDDuWZdzAPbcxzPDh0_cFzHDXu6jz7Z-bj8Aq5V9Qs?type=png)](https://mermaid.live/edit#pako:eNqNUk1vgkAQ_StkTm2CRpDvGA-GSxNNjdyavazsUGmAJbtLUmr8711ApHow5bLMm9n33szOGVLOECJICyplnNNPQUtSkYrlAlOV88rYHrq4zxtJihXu9I3COJPK0F_OhpMfv3S9HIJUIFX43kMvrwN2bPKCjQFDqQRvu_DSsY_8MVW0p3_GXgteo1Btgs_0BuyABe26kKe8vs_sJ5Z_WRwMbjllMVebt92e6knJcQyrVd3FqFCs1wNEhaDtpskyFAMgb8O7KozN3ikUN4WJO2uq_i066r700QaBBYHZbE3AIpD80XlaGE8GJtUx-XgTTChRlDRnelt6ZwTUCUskEOlfhhltCkVAO9SltFE8aasUIiUaNKGpdbd43S-IMlpIjSLLFRe76wZ2hwk1rSA6wzdEtmfNLct3Lc8OlqHnha4JrYbtuRP6nuuElm97wdK9mPDDuWZdzAPbcxzPDh0_cFzHDXu6jz7Z-bj8Aq5V9Qs)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/dotbim
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll import a .BIM file into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and a {@link @xeokit/data!DataModel | DataModel}. The {@link @xeokit/core/components!SDKError} class
 * is used to handle errors that may occur during the process:
 *
 * ````javascript
 * import { Scene } from "@xeokit/scene";
 * import { Data } from "@xeokit/data";
 * import { loadDotBIM } from "@xeokit/dotbim";
 *
 * const scene = new Scene();
 * const data = new Data();
 * const dataModel = data.createModel({ id: "myModel" });
 * const sceneModel = scene.createModel({ id: "myModel" });
 *
 * if (dataModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else if (sceneModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else {
 *      fetch("myModel.bim")
 *          .then(response => response.json())
 *          .then(data => {
 *
 *              const fileData = JSON.parse(data);
 *
 *              return loadDotBIM({
 *                  data: fileData,
 *                  sceneModel,
 *                  dataModel
 *              });
 *
 *          }).then(() => {
 *              sceneModel.build();
 *              dataModel.build();
 *          });
 * }
 * ````
 *
 * @module @xeokit/dotbim
 */
export * from "./loadDotBIM";