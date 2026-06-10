import type {Data} from "./Data";
import type {DataObject} from "./DataObject";
import {SDKErrorType, type SDKResult} from "../../base/core";
import type {SearchParams} from "./SearchParams";

/**
 * Finds {@link DataObject | DataObjects} in a {@link Data | Data} using a customized
 * depth-first traversal.
 *
 * Usually used to recursively find DataObjects of specific {@link DataObject.type | types}
 * within a hierarchy.
 *
 * See {@link data | @xeokit/sdk/model/data} for usage.
 *
 * @param data The Data to search.
 * @param searchParams Search parameters.
 * @returns A result indicating success or an error message on failure.
 * - On success: `{ ok: true, value: undefined }`
 * - On failure: `{ ok: false, error: string }`
 */
export function searchObjects(data: Data, searchParams: SearchParams): SDKResult<void> {
  if (data.destroyed) {
    return {
      ok: false,
      type: SDKErrorType.InvalidOperation,
      error: "[searchObjects] Data already destroyed"
    };
  }
  const includeObjects = (searchParams.includeObjects && searchParams.includeObjects.length > 0) ? arrayToMap(searchParams.includeObjects) : null;
  const excludeObjects = (searchParams.excludeObjects && searchParams.excludeObjects.length > 0) ? arrayToMap(searchParams.excludeObjects) : null;
  const includeRelating = (searchParams.includeRelating && searchParams.includeRelating.length > 0) ? arrayToMap(searchParams.includeRelating) : null;
  const excludeRelating = (searchParams.excludeRelating && searchParams.excludeRelating.length > 0) ? arrayToMap(searchParams.excludeRelating) : null;

  function visit(dataObject: DataObject, depth: number) {
    if (!dataObject) {
      return;
    }
    let includeObject = true;
    if (excludeObjects && excludeObjects[dataObject.type]) {
      includeObject = false;
    } else {
      if (includeObjects && (!includeObjects[dataObject.type])) {
        includeObject = false;
      }
    }
    if (depth === 0 && searchParams.includeStart === false) {
      includeObject = false;
    }
    if (includeObject) {
      if (searchParams.resultObjectIds) {
        searchParams.resultObjectIds.push(dataObject.id);
      } else if (searchParams.resultObjects) {
        searchParams.resultObjects.push(dataObject);
      } else if (searchParams.resultCallback) {
        if (searchParams.resultCallback(dataObject)) {
          return; // Stop searching
        }
      }
    }
    const related = dataObject.related;
    for (const type in related) {
      const relations = related[type];
      if (relations) {
        for (let i = 0, len = relations.length; i < len; i++) {
          let includeRelation = true;
          // Filter by the RELATIONSHIP type (the `related` map key), per the
          // documented "types of Relationships to follow/exclude" — not the
          // relating object's own type.
          if (excludeRelating && excludeRelating[type]) {
            includeRelation = false;
          } else {
            if (includeRelating && (!includeRelating[type])) {
              includeRelation = false;
            }
          }
          if (includeRelation) {
            visit(relations[i].relatedObject, depth + 1);
          }
        }
      }
    }
  }

  const depth = 0;
  if (searchParams.startObjectId) {
    const startObject = data.objects[searchParams.startObjectId];
    if (!startObject) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[searchObjects] Cannot search DataObjects - starting DataObject not found in Data: "${searchParams.startObjectId}"`
      };
    }
    visit(startObject, depth);
  } else if (searchParams.startObject) {
    if (searchParams.startObject.data != data) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[searchObjects] Cannot search DataObjects - starting DataObject not in same Data: "${searchParams.startObjectId}"`
      };
    }
    visit(searchParams.startObject, depth + 1);
  } else {
    for (const id in data.rootObjects) {
      visit(data.rootObjects[id], depth + 1);
    }
  }

  return {
    ok: true,
    value: undefined
  };
}
function arrayToMap(array: any[]): { [key: string]: any } {
  const map: { [key: string]: any } = {};
  for (let i = 0, len = array.length; i < len; i++) {
    map[array[i]] = true;
  }
  return map;
}
