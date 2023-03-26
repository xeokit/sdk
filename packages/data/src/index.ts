/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdata.svg)](https://badge.fury.io/js/%40xeokit%2Fdata)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/data/badge)](https://www.jsdelivr.com/package/npm/@xeokit/data)
 *
 * <img style="padding:50px" src="media://images/xeokit_datamodel_icon.png"/>
 *
 * # xeokit Data Graph
 *
 *
 * The xeokit SDK employs a generic entity-relationship data graph to manage model semantics. This graph includes entities,
 * properties, and relationships and is compatible with both the browser and NodeJS. It serves as a versatile tool for generating
 * models, converting between model formats, and navigating content within the model viewer.
 *
 * In more detail, the xeokit SDK utilizes a Data container class that holds DataModels consisting of DataObjects, PropertySets, and
 * Relationships, as shown in the diagram below.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg?type=png)](https://mermaid.live/edit#pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg)
 *
 * Various model file formats can be imported into DataModels using methods such as loadGLTF, loadLAS, loadCityJSON, and loadXKT,
 * while DataModels can be exported to the native XKT format using saveXKT.
 *
 * To programmatically build DataModels, builder methods
 * such as Data.createModel, DataModel.createObject, DataModel.createPropertySet, and DataModel.createRelationship can be employed.
 * DataObjects can be queried using the Data.searchObjects method, and semantic data can be attached to model representations by
 * using it alongside SceneModel.
 *
 * It's important to note that DataObjects and PropertySets are global, created on their DataModels but stored globally on the Data.
 * Additionally, DataModels automatically reuse DataObjects and PropertySets wherever they're already created by other DataModels. Finally,
 * DataObjects can have Relationships with other DataObjects in different DataModels.
 *
 * To use the xeokit SDK, install it with npm install @xeokit/data. Users can then create a DataModel from JSON or using builder methods,
 * read DataObjects, and search for DataObjects.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/data
 * ````
 *
 * ## Usage
 *
 * * [Creating a DataModel from JSON](#creating-a-scenemodel)
 * * [Creating a DataModel using Builder Methods](#creating-a-scenemodel)
 * * [Reading DataObjects](#reading-dataobjects)
 * * [Searching DataObjects](#searching-dataobjects)
 *
 * ### Creating a DataModel from JSON
 *
 * We will start with an example where we create a DataModel using a single parameter object of type DataModelParams.
 * The DataModel we create will define a simple piece of furniture - a table consisting of a tabletop and four legs.
 * We will then query the data model to retrieve all the objects within it.
 *
 * To achieve this, we will create a DataModel that contains six DataObjects: one for the table, one for the tabletop,
 * and one for each of the four legs. We will also define Relationships to connect the DataObjects into an aggregation
 * hierarchy, and we will assign PropertySets to the DataObjects to give them attributes such as height and weight.
 *
 * To give the DataObjects and Relationships semantic meaning, we will assign them types from one of the SDK's bundled
 * data type sets, basicTypes. This set of types classifies each DataObject as a BasicEntity and each Relationship as a BasicAggregation.
 *
 * It's worth noting that in a real-world scenario, we would likely use a more complex set of data types, such as
 * ifcTypes. However, we cannot mix different sets of data types within our Data, as traversals of the DataObjects
 * with Data.searchObjects must be guided uniformly by the same set of types across all the DataObjects and Relationships
 * in the graph.
 *
 * To create our DataModel, we will use the following code, which creates a new Data object and then creates a DataModel
 * from a set of objects, relationships, and property sets. The SDKError class is used to handle errors that may occur
 * during the process:
 *
 *
 * ````javascript
 * import { SDKError } from "@xeokit/core/components";
 * import { Data } from "@xeokit/data";
 * import * as basicTypes from "@xeokit/datatypes/basicTypes";
 *
 * const myData = new Data({});
 *
 * const myDataModel = myData.createModel({
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
 *         {
 *           name: "Weight",
 *           value: 5,
 *           type: "",
 *           valueType: "",
 *           description: "Weight of the thing",
 *         },
 *         {
 *           name: "Height",
 *           value: 12,
 *           type: "",
 *           valueType: "",
 *           description: "Height of the thing",
 *         },
 *       ],
 *     },
 *     {
 *       id: "legPropertySet",
 *       originalSystemId: "legPropertySet",
 *       name: "Table leg properties",
 *       type: "",
 *       properties: [
 *         {
 *           name: "Weight",
 *           value: 5,
 *           type: "",
 *           valueType: "",
 *           description: "Weight of the thing",
 *         },
 *         {
 *           name: "Height",
 *           value: 12,
 *           type: "",
 *           valueType: "",
 *           description: "Height of the thing",
 *         },
 *       ],
 *     },
 *   ],
 * });
 *
 * if (myDataModel instanceof SDKError) {
 *   console.log(myDataModel.message);
 * } else {
 *   myDataModel.build();
 * }
 * ````
 *
 * ### Creating a DataModel using Builder Methods
 *
 * In our second example, we'll create our {@link @xeokit/data!DataModel | DataModel} again, this time instantiating
 * each {@link PropertySet}, {@link Property}, {@link DataObject} and {@link Relationship} individually, using the
 * DataModel's builder methods.
 *
 * ````javascript
 * import {SDKError} from "@xeokit/core/components";
 * import {Data} from "@xeokit/data";
 * import * as basicTypes from "@xeokit/datatypes/basicTypes";
 *
 * const myData = new Data();
 *
 * const myDataModel = myData.createModel({ // DataModel | SDKError
 *     id: "myTableModel"
 * });
 *
 * if (myDataModel instanceof SDKError) {
 *      console.log(myDataModel.message);
 *
 * } else {
 *
 *      const tablePropertySet = myDataModel.createPropertySet({ // PropertySet | SDKError
 *          id: "tablePropertySet",
 *          name: "Table properties",
 *          type: "",
 *          properties: [ // Property[]
 *              {
 *                  name: "Weight",
 *                  value: 5,
 *                  type: "",
 *                  valueType: "",
 *                  description: "Weight of the thing"
 *              },
 *              {
 *                  name: "Height",
 *                  value: 12,
 *                  type: "",
 *                  valueType: "",
 *                  description: "Height of the thing"
 *              }
 *          ]
 *      });
 *
 *      if (tablePropertySet instanceof SDKError) {
 *          console.log(tablePropertySet.message);
 *      }
 *
 *      const legPropertySet = myDataModel.createPropertySet({
 *          id: "legPropertySet",
 *          name: "Table leg properties",
 *          type: "",
 *          properties: [
 *              {
 *                  name: "Weight",
 *                  value: 5,
 *                  type: "",
 *                  valueType: "",
 *                  description: "Weight of the thing"
 *              },
 *              {
 *                  name: "Height",
 *                  value: 12,
 *                  type: "",
 *                  valueType: "",
 *                  description: "Height of the thing"
 *              }
 *          ]
 *      });
 *
 *      const myTableObject = myDataModel.createObject({ // DataObject | SDKError
 *          id: "table",
 *          type:  basicTypes.BasicEntity,
 *          name: "Table",
 *          propertySetIds: ["tablePropertySet"]
 *      });
 *
 *      if (myTableObject instanceof SDKError) {
 *          console.log(myTableObject.message);
 *      }
 *
 *      myDataModel.createObject({
 *          id: "redLeg",
 *          name: "Red table Leg",
 *          type:  basicTypes.BasicEntity,
 *          propertySetIds: ["tableLegPropertySet"]
 *      });
 *
 *      myDataModel.createObject({
 *          id: "greenLeg",
 *          name: "Green table leg",
 *          type:  basicTypes.BasicEntity,
 *          propertySetIds: ["tableLegPropertySet"]
 *      });
 *
 *      myDataModel.createObject({
 *          id: "blueLeg",
 *          name: "Blue table leg",
 *          type:  basicTypes.BasicEntity,
 *          propertySetIds: ["tableLegPropertySet"]
 *      });
 *
 *      myDataModel.createObject({
 *          id: "yellowLeg",
 *          name: "Yellow table leg",
 *          type: "leg",
 *          propertySetIds: ["tableLegPropertySet"]
 *      });
 *
 *      myDataModel.createObject({
 *          id: "tableTop",
 *          name: "Purple table top",
 *          type:  basicTypes.BasicEntity,
 *          propertySetIds: ["tableTopPropertySet"]
 *      });
 *
 *      const myRelationship = myDataModel.createRelationship({
 *          type: basicTypes.BasicAggregation,
 *          relatingObjectId: "table",
 *          relatedObjectId: "tableTop"
 *      });
 *
 *      if (myRelationship instanceof SDKError) {
 *              console.log(myRelationship.message);
 *      }
 *
 *      myDataModel.createRelationship({
 *          type: basicTypes.BasicAggregation,
 *          relatingObjectId: "tableTop",
 *          relatedObjectId: "redLeg"
 *      });
 *
 *      myDataModel.createRelationship({
 *          type: basicTypes.BasicAggregation,
 *          relatingObjectId: "tableTop",
 *          relatedObjectId: "greenLeg"
 *      });
 *
 *      myDataModel.createRelationship({
 *          type: basicTypes.BasicAggregation,
 *          relatingObjectId: "tableTop",
 *          relatedObjectId: "blueLeg"
 *      });
 *
 *      myDataModel.createRelationship({
 *          type: basicTypes.BasicAggregation,
 *          relatingObjectId: "tableTop",
 *          relatedObjectId: "yellowLeg"
 *      });
 *
 *      const buildResult = myDataModel.build(); // void | SDKError
 *
 *      if (buildResult instanceof SDKError) {
 *          console.log(buildResult.message);
 *      } else {
 *          // Ready for action
 *      }
 * }
 * ````
 *
 * ### Reading DataObjects
 *
 * With our SceneModel built, we'll now use the {@link Data.searchObjects} method to
 * traverse it to fetch the IDs of the {@link DataObject | DataObjects} we find on that path.
 *
 * One example of where we use this method is to query the aggregation hierarchy of the DataObjects for building
 * a tree view of an IFC element hierarchy.
 *
 * ````javascript
 * const resultObjectIds = [];
 *
 * myData.searchObjects({
 *     startObjectId: "table",
 *     includeObjects: [basicTypes.BasicEntity],
 *     includeRelated: [basicTypes.BasicAggregation],
 *     resultObjectIds
 * });
 *
 * // resultObjectIds == ["table", "tableTop", "redLeg", "greenLeg", "blueLeg", "yellowLeg"];
 * ````
 *
 * ### Searching DataObjects
 *
 * In our fourth example, we'll demonstrate how to traverse the {@link DataObject | DataObjects} along their
 * {@link Relationship | Relationships}. We'll start at the root DataObject and visit all the DataObjects
 * we encounter along the outgoing Relationships.
 *
 * ````javascript
 * const table = myData.objects["table"];
 *
 * const relations = table.related[basicTypes.BasicAggregation];
 *
 * for (let i = 0, len = relations.length; i < len; i++) {
 *
 *      const relation = relations[i];
 *      const dataObject = relation.related;
 *
 *      //..
 * }
 * ````
 *
 * @module @xeokit/data
 */
export * from "./Data";
export * from "./DataModel";
export * from "./DataObject";
export * from "./Relationship";
export * from "./RelationshipParams";
export * from "./Property";
export * from "./PropertySet";
export * from "./DataModelParams";
export * from "./DataObjectParams";
export * from "./PropertyParams";
export * from "./PropertySetParams";
export * from "./SearchParams";