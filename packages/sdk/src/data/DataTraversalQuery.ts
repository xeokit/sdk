import type {Data} from "./Data";
import type {DataObject} from "./DataObject";
import {SDKInternalException} from "../core";

/**
 * Traverses a {@link data!Data | Data} to collect {@link data!DataObject | DataObjects} that matching given search criteria.
 *
 * See {@link data | @xeokit/sdk/data} for usage.
 */
export class DataTraversalQuery {
  private data: Data;
  private startObjectId: any;
  private includeObjects: boolean;
  private excludeObjects: boolean;
  private includeRelating: boolean;
  private excludeRelating: boolean;
  private resultObjectIds: any;

  constructor(params: {
    data: Data
  }) {
    this.data = params.data;
  }

  /**
   * TODO
   */
  query(): void | SDKInternalException {
    if (!this.data) {
      return new SDKInternalException("Data already destroyed");
    }
    // const includeObjects = (this.includeObjects && this.includeObjects.length > 0) ? arrayToMap(this.includeObjects) : null;
    // const excludeObjects = (this.excludeObjects && this.excludeObjects.length > 0) ? arrayToMap(this.excludeObjects) : null;
    // const includeRelating = (this.includeRelating && this.includeRelating.length > 0) ? arrayToMap(this.includeRelating) : null;
    // const excludeRelating = (this.excludeRelating && this.excludeRelating.length > 0) ? arrayToMap(this.excludeRelating) : null;

    const visit = (dataObject: DataObject, depth: number) => {
      if (!dataObject) {
        return;
      }
      const includeObject = true;
      // if (excludeObjects && excludeObjects[dataObject.type]) {
      //     includeObject = false;
      // } else { // @ts-ignore
      //     if (includeObjects && (!includeObjects[dataObject.type])) {
      //         includeObject = false;
      //     }
      // }
      // if (depth === 0 && this.includeStart === false) {
      //     includeObject = false;
      // }
      // if (includeObject) {
      //     if (this.resultObjectIds) {
      //         this.resultObjectIds.push(dataObject.id);
      //     } else if (this.resultObjects) {
      //         this.resultObjects.push(dataObject);
      //     } else if (this.resultCallback) {
      //         if (this.resultCallback(dataObject)) {
      //         }
      //     }
      // }
      const related = dataObject.related;
      for (const type in related) {
        const relations = related[type];
        if (relations) {
          // for (let i = 0, len = relations.length; i < len; i++) {
          //     let includeRelation = true;
          //     if (excludeRelating && excludeRelating[dataObject.type]) {
          //         includeRelation = false;
          //     } else {
          //         if (includeRelating && (!includeRelating[dataObject.type])) {
          //             includeRelation = false;
          //         }
          //     }
          //     if (includeRelation) {
          //         visit(relations[i].relatedObject, depth + 1);
          //     }
          // }
        }
      }
    }

    const depth = 0;
    if (this.startObjectId) {
      const startObject = this.data.objects[this.startObjectId];
      if (!startObject) {
        return new SDKInternalException(`Cannot search DataObjects - starting DataObject not found in Data: "${this.startObjectId}"`);
      }
      visit(startObject, depth);
    } else {
      for (const id in this.data.rootObjects) {
        visit(this.data.rootObjects[id], depth + 1);
      }
    }
  }
}
