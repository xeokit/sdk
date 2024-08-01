/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdtx.svg)](https://badge.fury.io/js/%40xeokit%2Fdtx)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/dtx/badge)](https://www.jsdelivr.com/package/npm/@xeokit/dtx)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) Format Importer and Exporter
 *
 * ---
 *
 * ### *Import and export SceneModels as xeokit's native binary [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) format*
 *
 * ---
 *
 * This package allows us to import and export xeokit {@link @xeokit/scene!SceneModel | SceneModels} as [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx), a
 * compact binary-encoded runtime asset delivery format for geometry and materials.
 *
 * To import a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) model into xeokit, use the {@link loadDTX} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel}. To export a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) model, use the {@link saveDTX} function, which will save a
 * {@link @xeokit/scene!SceneModel | SceneModel} to [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx).
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNkk1PwzAMhv9K5RNI3dSPtemqaafd2ASiICGUS9a4ENQ2U5MixrT_Tvo1WiEQvaSvHT9-rfgEqeQIMaQ5U2oj2EvFClrSkosKUy1kaW3vG93mrSTFEnemIrdOtLTMJ3h3yv2bua86kVbINN62oavrLravRc4HwVHpSh4beW7oA38rGX-6ebhjxoUaWqxWh0ajxmq97kKZyHHDNOuUurjqcR0s72DfmKwu25Eayuhewt7xP03HbSYA1QH-aDSZi4JDYTZbU3ApJCNob3hITYpi61Ghsi6mVIOdOP8V29u7pMZFP7BgQ4FVwQQ3S9EOREG_YoEUYvPLMWN1rimYwcxVVmuZHMsUYl3VaEN94Obh-zWCOGO5MlHkQstq1y9ac9hwYCXEJ_iA2HP8eRiFAXHDZUA8J7DhCPHCieYRWRDPJ15EiB-cbfiU0kCdeeD4hLjL0DFh33Nb2HOba1ycvwAqVO7G?type=png)](https://mermaid.live/edit#pako:eNqNkk1PwzAMhv9K5RNI3dSPtemqaafd2ASiICGUS9a4ENQ2U5MixrT_Tvo1WiEQvaSvHT9-rfgEqeQIMaQ5U2oj2EvFClrSkosKUy1kaW3vG93mrSTFEnemIrdOtLTMJ3h3yv2bua86kVbINN62oavrLravRc4HwVHpSh4beW7oA38rGX-6ebhjxoUaWqxWh0ajxmq97kKZyHHDNOuUurjqcR0s72DfmKwu25Eayuhewt7xP03HbSYA1QH-aDSZi4JDYTZbU3ApJCNob3hITYpi61Ghsi6mVIOdOP8V29u7pMZFP7BgQ4FVwQQ3S9EOREG_YoEUYvPLMWN1rimYwcxVVmuZHMsUYl3VaEN94Obh-zWCOGO5MlHkQstq1y9ac9hwYCXEJ_iA2HP8eRiFAXHDZUA8J7DhCPHCieYRWRDPJ15EiB-cbfiU0kCdeeD4hLjL0DFh33Nb2HOba1ycvwAqVO7G)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/dtx
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll use {@link loadDTX} to import a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file into
 * a {@link @xeokit/scene!SceneModel | SceneModel}. The {@link @xeokit/core!SDKError | SDKError} class is used to handle errors that may occur during the process:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {loadDTX, saveDTX} from "@xeokit/dtx";
 *
 * const scene = new Scene();
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel
 * });
 *
 * if (sceneModel instanceof SDKError) {
 *      console.error(dataModel.message);
 * } else {
 *      fetch("myModel.dtx").then(response => {
 *         response.arrayBuffer().then(fileData => {
 *              loadDTX({ fileData, sceneModel });
 *              sceneModel.build();
 *          });
 *      });
 * });
 * ````
 *
 * Using {@link @xeokit/dtx!saveDTX | saveDTX} to export the {@link @xeokit/scene!SceneModel | SceneModel} back to
 * [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx):
 *
 * ````javascript
 * const arrayBuffer = saveDTX({
 *     dataModel,
 *     sceneModel
 * });
 * ````
 *
 * @module @xeokit/dtx
 */
export * from "./loadDTX";
export * from "./saveDTX";
export * from "./versions/v1/DTXData_v1";
