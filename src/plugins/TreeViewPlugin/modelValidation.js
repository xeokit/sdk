/**
 * Tests if {@link TreeViewPlugin} would be able to create a "types" hierarchy for the given {@link DataModel}.
 *
 * @param {DataModel} metaModel The DataModel.
 * @param {String[]} errors Accumulates messages for validation errors.
 * @return {boolean} Returns ````true```` if no errors found, else ````false````.
 */
function validateModelDataForTreeViewTypesHierarchy(metaModel, errors) {
    const rootObjectData = metaModel.rootObjectData;
    if (!rootObjectData) {
        errors.push("Can't build types hierarchy: model is empty");
        return false;
    }
    return true;
}

/**
 * Tests if {@link TreeViewPlugin} would be able to create a "storeys" hierarchy for the given {@link DataModel}.
 *
 * @param {DataModel} metaModel The DataModel.
 * @param {String[]} errors Accumulates messages for validation errors.
 * @return {boolean} Returns ````true```` if no errors found, else ````false````.
 */
function validateModelDataForTreeViewStoreysHierarchy(metaModel, errors) {
    const rootObjectData = metaModel.rootObjectData;
    if (!rootObjectData) {
        errors.push("Can't build storeys hierarchy: model is empty");
        return false;
    }
    return _validateModelDataForStoreysHierarchy(rootObjectData, errors);
}

/**
 * Tests if {@link TreeViewPlugin} would be able to create a "containment" hierarchy for the given {@link DataModel}.
 *
 * @param {DataModel} metaModel The DataModel.
 * @param {String[]} errors Accumulates messages for validation errors.
 * @return {boolean} Returns ````true```` if no errors found, else ````false````.
 */
function validateModelDataForTreeViewContainmentHierarchy(metaModel, errors) {
    const rootObjectData = metaModel.rootObjectData;
    if (!rootObjectData) {
        errors.push("Can't build containment hierarchy: model is empty");
        return false;
    }
    return true;
}

/**
 * @private
 */
function _validateModelDataForStoreysHierarchy(objectData, errors, level = 0, ctx, buildingNode) {
    ctx = ctx || {
        foundIFCBuildingStoreys: false
    };
    const objectDataType = objectData.type;
    const children = objectData.children;
    if (objectDataType === "IfcBuilding") {
        buildingNode = true;
    } else if (objectDataType === "IfcBuildingStorey") {
        if (!buildingNode) {
            errors.push("Can't build storeys hierarchy: IfcBuildingStorey found without parent IfcBuilding");
            return false;
        }
        ctx.foundIFCBuildingStoreys = true;
    }
    if (children) {
        for (let i = 0, len = children.length; i < len; i++) {
            const childObjectData = children[i];
            if (!_validateModelDataForStoreysHierarchy(childObjectData, errors, level + 1, ctx, buildingNode)) {
                return false;
            }
        }
    }
    if (level === 0) {
        if (!ctx.foundIFCBuildingStoreys) {
            // errors.push("Can't build storeys hierarchy: no IfcBuildingStoreys found");
        }
    }
    return true;
}

export {
    validateModelDataForTreeViewTypesHierarchy,
    validateModelDataForTreeViewStoreysHierarchy,
    validateModelDataForTreeViewContainmentHierarchy
};