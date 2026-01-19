/**
 * <img style="padding:50px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_datamodel_icon.png"/>
 *
 * # xeokit Semantic Data Model
 *
 * ---
 *
 * ***The SDK's buildable, queryable, importable, and exportable semantic data model***
 *
 * ---
 *
 * # Overview
 *
 * The xeokit SDK uses a generic entity-relationship graph to manage model semantics. The graph contains entities,
 * properties, and relationships, and works in both browser and NodeJS environments. Use it to build semantic graphs,
 * convert between formats, and navigate semantic content alongside the model Viewer.
 *
 * At the core is a {@link Data} container that holds one or more {@link DataModel | DataModels}. Each {@link DataModel}
 * contains {@link DataObject | DataObjects}, {@link PropertySet | PropertySets}, and {@link Relationship | Relationships},
 * as shown in the diagram below.
 *
 * <br>
 *
 * [![Mermaid diagram](https://mermaid.ink/img/pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg?type=png)](https://mermaid.live/edit#pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg)
 *
 * <br>
 *
 * DataModels can be imported from various formats via loaders such as {@link gltf!GLTFLoader | GLTFLoader}, {@link las!LASLoader | LASLoader},
 * {@link cityjson!CityJSONLoader | CityJSONLoader}, {@link ifc!IFCLoader | IFCLoader}, {@link dotbim!DotBIMLoader | DotBIMLoader}, and {@link xgf!XGFLoader | XGFLoader}.
 * DataModels can also be exported using exporters such as {@link dotbim!DotBIMExporter | DotBIMExporter}.
 *
 * To build DataModels programmatically, use builder methods such as {@link Data.createModel}, {@link DataModel.createObject},
 * {@link DataModel.createPropertySet}, and {@link DataModel.createRelationship}. Query DataObjects using {@link searchObjects},
 * and attach semantic data to model representations by using Data alongside {@link scene!SceneModel | SceneModel}.
 *
 * <br>
 *
 * ### Notes
 *
 * * {@link DataObject | DataObjects} and {@link PropertySet | PropertySets} are created on their {@link DataModel}, but are stored globally on {@link Data}.
 * * {@link DataModel | DataModels} reuse {@link DataObject | DataObjects} and {@link PropertySet | PropertySets} when they already exist in the {@link Data}.
 * * {@link DataObject | DataObjects} can form {@link Relationship | Relationships} with DataObjects that belong to other DataModels within the same {@link Data}.
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
 * # Usage
 *
 * <br>
 *
 * ## Creating a DataModel from JSON
 *
 * This example creates a {@link DataModel} from a {@link DataModelParams} object that defines a simple piece of furniture:
 * a table consisting of a tabletop and four legs. The example then queries the model to retrieve the IDs of the
 * {@link DataObject | DataObjects} it contains.
 *
 * The DataModel defines:
 *
 * * six DataObjects (table, tabletop, and four legs),
 * * aggregation Relationships that connect them into a hierarchy, and
 * * Properties on PropertySets that give the objects attributes such as height and weight.
 *
 * To give DataObjects and Relationships semantic meaning, the example assigns types from the SDK's bundled type set
 * {@link "basictypes" | @xeokit/basictypes}. This classifies each DataObject as a {@link basictypes!BasicEntity | BasicEntity}
 * and each Relationship as a {@link basictypes!BasicAggregation | BasicAggregation}.
 *
 * In real projects you may use a richer type set such as {@link "ifctypes" | @xeokit/ifctypes}. Note that different type sets
 * must not be mixed within the same {@link Data}: traversals performed by {@link searchObjects} are guided by a single, consistent
 * type system across the DataObject and Relationship graph.
 *
 * All methods in this example return {@link core!SDKResult | SDKResult} values, which are checked for errors.
 *
 * ````javascript
 * import { SDKResult } from "@xeokit/sdk/core";
 * import { Data } from "@xeokit/sdk/data";
 * import * as basicTypes from "@xeokit/sdk/basictypes/basicTypes";
 *
 * const myData = new Data({});
 *
 * const result: SDKResult<DataModel> = myData.createModel({
 *   id: "myTableModel",
 *   objects: [
 *     {
 *       id: "table",
 *       type: basicTypes.BasicEntity,
 *       name: "Table",
 *       propertySetIds: ["tablePropertySet"],
 *     },
 *     {
 *       id: "redLeg",
 *       name: "Red table Leg",
 *       type: basicTypes.BasicEntity,
 *       propertySetIds: ["legPropertySet"],
 *     },
 *     {
 *       id: "greenLeg",
 *       name: "Green table leg",
 *       type: basicTypes.BasicEntity,
 *       propertySetIds: ["legPropertySet"],
 *     },
 *     {
 *       id: "blueLeg",
 *       name: "Blue table leg",
 *       type: basicTypes.BasicEntity,
 *       propertySetIds: ["legPropertySet"],
 *     },
 *     {
 *       id: "yellowLeg",
 *       name: "Yellow table leg",
 *       type: basicTypes.BasicEntity,
 *       propertySetIds: ["legPropertySet"],
 *     },
 *     {
 *       id: "tableTop",
 *       name: "Purple table top",
 *       type: basicTypes.BasicEntity,
 *       propertySetIds: ["tableTopPropertySet"],
 *     },
 *   ],
 *   relationships: [
 *     {
 *       type: basicTypes.BasicAggregation,
 *       relatingObjectId: "table",
 *       relatedObjectId: "tableTop",
 *     },
 *     {
 *       type: basicTypes.BasicAggregation,
 *       relatingObjectId: "tableTop",
 *       relatedObjectId: "redLeg",
 *     },
 *     {
 *       type: basicTypes.BasicAggregation,
 *       relatingObjectId: "tableTop",
 *       relatedObjectId: "greenLeg",
 *     },
 *     {
 *       type: basicTypes.BasicAggregation,
 *       relatingObjectId: "tableTop",
 *       relatedObjectId: "blueLeg",
 *     },
 *     {
 *       type: basicTypes.BasicAggregation,
 *       relatingObjectId: "tableTop",
 *       relatedObjectId: "yellowLeg",
 *     },
 *   ],
 *   propertySets: [
 *     {
 *       id: "tablePropertySet",
 *       originalSystemId: "tablePropertySet",
 *       name: "Table properties",
 *       type: "",
 *       properties: [
 *         { name: "Weight", value: 5, type: "", valueType: "", description: "Weight of the thing" },
 *         { name: "Height", value: 12, type: "", valueType: "", description: "Height of the thing" },
 *       ],
 *     },
 *     {
 *       id: "legPropertySet",
 *       originalSystemId: "legPropertySet",
 *       name: "Table leg properties",
 *       type: "",
 *       properties: [
 *         { name: "Weight", value: 5, type: "", valueType: "", description: "Weight of the thing" },
 *         { name: "Height", value: 12, type: "", valueType: "", description: "Height of the thing" },
 *       ],
 *     },
 *   ],
 * });
 *
 * if (!result.ok) {
 *   console.error(result.error);
 * } else {
 *   const dataModel = result.value;
 *   console.log("DataModel created:", dataModel.id);
 * }
 * ````
 *
 * <br>
 *
 * ## Creating a DataModel using Builder Methods
 *
 * This example recreates the same DataModel, but builds each {@link PropertySet}, {@link Property}, {@link DataObject},
 * and {@link Relationship} individually using {@link DataModel} builder methods. All builder methods return
 * {@link core!SDKResult | SDKResult}.
 *
 * ````ts
 * import { SDKResult } from "@xeokit/sdk/core";
 * import { Data, searchObjects } from "@xeokit/sdk/data";
 * import * as basicTypes from "@xeokit/sdk/basictypes/basicTypes";
 *
 * const data = new Data();
 *
 * const modelRes: SDKResult<DataModel> = data.createModel({
 *   id: "myTableModel",
 * });
 *
 * if (!modelRes.ok) {
 *   console.error(modelRes.error);
 * } else {
 *   const dataModel = modelRes.value;
 *
 *   const tablePSRes: SDKResult<PropertySet> = dataModel.createPropertySet({
 *     id: "tablePropertySet",
 *     name: "Table properties",
 *     type: "",
 *     properties: [
 *       { name: "Weight", value: 5, type: "", valueType: "", description: "Weight of the thing" },
 *       { name: "Height", value: 12, type: "", valueType: "", description: "Height of the thing" },
 *     ],
 *   });
 *   if (!tablePSRes.ok) console.log(tablePSRes.error);
 *
 *   const legPSRes: SDKResult<PropertySet> = dataModel.createPropertySet({
 *     id: "legPropertySet",
 *     name: "Table leg properties",
 *     type: "",
 *     properties: [
 *       { name: "Weight", value: 5, type: "", valueType: "", description: "Weight of the thing" },
 *       { name: "Height", value: 12, type: "", valueType: "", description: "Height of the thing" },
 *     ],
 *   });
 *   if (!legPSRes.ok) console.log(legPSRes.error);
 *
 *   const tableRes: SDKResult<DataObject> = dataModel.createObject({
 *     id: "table",
 *     type: basicTypes.BasicEntity,
 *     name: "Table",
 *     propertySetIds: ["tablePropertySet"],
 *   });
 *   if (!tableRes.ok) console.log(tableRes.error);
 *
 *   dataModel.createObject({
 *     id: "redLeg",
 *     name: "Red table Leg",
 *     type: basicTypes.BasicEntity,
 *     propertySetIds: ["tableLegPropertySet"],
 *   });
 *
 *   dataModel.createObject({
 *     id: "greenLeg",
 *     name: "Green table leg",
 *     type: basicTypes.BasicEntity,
 *     propertySetIds: ["tableLegPropertySet"],
 *   });
 *
 *   dataModel.createObject({
 *     id: "blueLeg",
 *     name: "Blue table leg",
 *     type: basicTypes.BasicEntity,
 *     propertySetIds: ["tableLegPropertySet"],
 *   });
 *
 *   dataModel.createObject({
 *     id: "yellowLeg",
 *     name: "Yellow table leg",
 *     type: basicTypes.BasicEntity,
 *     propertySetIds: ["tableLegPropertySet"],
 *   });
 *
 *   dataModel.createObject({
 *     id: "tableTop",
 *     name: "Purple table top",
 *     type: basicTypes.BasicEntity,
 *     propertySetIds: ["tableTopPropertySet"],
 *   });
 *
 *   const rel1Res: SDKResult<Relationship> = dataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relatingObjectId: "table",
 *     relatedObjectId: "tableTop",
 *   });
 *   if (!rel1Res.ok) console.log(rel1Res.error);
 *
 *   dataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relatingObjectId: "tableTop",
 *     relatedObjectId: "redLeg",
 *   });
 *   dataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relatingObjectId: "tableTop",
 *     relatedObjectId: "greenLeg",
 *   });
 *   dataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relatingObjectId: "tableTop",
 *     relatedObjectId: "blueLeg",
 *   });
 *   dataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relatingObjectId: "tableTop",
 *     relatedObjectId: "yellowLeg",
 *   });
 * }
 * ````
 *
 * <br>
 *
 * ## Reading DataObjects
 *
 * With the {@link DataModel} built, use {@link searchObjects} to traverse the graph and collect the IDs of visited
 * {@link DataObject | DataObjects}. One common use case is building a tree view of an IFC element hierarchy by traversing
 * aggregation Relationships.
 *
 * ````ts
 * const resultObjectIds: string[] = [];
 *
 * searchObjects(data, {
 *   startObjectId: "table",
 *   includeObjects: [basicTypes.BasicEntity],
 *   includeRelated: [basicTypes.BasicAggregation],
 *   resultObjectIds,
 * });
 *
 * // resultObjectIds == ["table", "tableTop", "redLeg", "greenLeg", "blueLeg", "yellowLeg"];
 * ````
 *
 * <br>
 *
 * ## Searching DataObjects
 *
 * This example follows outgoing {@link Relationship | Relationships} from a root {@link DataObject}:
 *
 * ````ts
 * const table = data.objects["table"];
 * const relations = table.related[basicTypes.BasicAggregation];
 *
 * for (let i = 0, len = relations.length; i < len; i++) {
 *   const relation = relations[i];
 *   const dataObject = relation.related;
 *   // ..
 * }
 * ````
 *
 * <br>
 *
 * ## Serializing a DataModel to JSON
 *
 * ````ts
 * const dataModelParams = dataModel.toParams();
 * ````
 *
 * <br>
 *
 * ## Deserializing a DataModel from JSON
 *
 * ````ts
 * const dataModel2Res = data.createModel({ id: "myDataModel2" });
 * if (dataModel2Res.ok) {
 *   const dataModel2 = dataModel2Res.value;
 *   dataModel2.fromParams(dataModelParams);
 * } else {
 *   console.error(dataModel2Res.error);
 * }
 * ````
 *
 * <br>
 *
 * ## Destroying a DataModel
 *
 * ````ts
 * dataModel2.destroy();
 * ````
 *
 * <br>
 *
 * ## Loading a DataModel from a File
 *
 * Import {@link DataModel | DataModels} from supported file formats. For example, use {@link dotbim!DotBIMLoader | DotBIMLoader}
 * to load a DotBIM file into a new {@link scene!SceneModel | SceneModel} and {@link DataModel}:
 *
 * ````ts
 * const sceneModel3 = scene.createModel({ id: "myModel3" });
 *
 * const dataModel3Res = data.createModel({ id: "myModel3" });
 * if (!dataModel3Res.ok) {
 *   console.error(dataModel3Res.error);
 * } else {
 *   const dataModel3 = dataModel3Res.value;
 *
 *   fetch("model.json")
 *     .then((response) => response.json())
 *     .then((fileData) =>
 *       DotBIMLoader({
 *         fileData,
 *         sceneModel3,
 *         dataModel3,
 *       })
 *     )
 *     .then(() => {
 *       // Loaded
 *     })
 *     .catch((err) => {
 *       sceneModel3.destroy();
 *       dataModel3.destroy();
 *       console.error(`Error loading DotBIM: ${err}`);
 *     });
 * }
 * ````
 *
 * <br>
 *
 * ## Handling Events
 *
 * All events for a {@link Data} are emitted through {@link DataEvents}, accessible via {@link Data.events}. For example,
 * to listen for creation and destruction of DataModels within the Data:
 *
 * ````ts
 * data.events.onModelCreated.subscribe((data, dataModel) => {
 *   console.log(`New DataModel created with ID: ${dataModel.id}`);
 * });
 *
 * data.events.onModelDestroyed.subscribe((data, dataModel) => {
 *   console.log(`DataModel destroyed with ID: ${dataModel.id}`);
 * });
 * ````
 *
 * @module data
 */

export * from "./Data";
export * from "./DataEvents";
export * from "./DataModel";
export * from "./DataObject";
export * from "./Relationship";
export * from "./RelationshipParams";
export * from "./Property";
export * from "./PropertySet";
export * from "./DataModelParams";
export * from "./DataModelContentParams";
export * from "./DataObjectParams";
export * from "./PropertyParams";
export * from "./PropertySetParams";
export * from "./SearchParams";
export * from "./searchObjects";
export * from "./DataModelParamsLoader";
export * from "./DataModelParamsExporter";
export * from "./DataModelStats";
