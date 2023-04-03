

export const BasicAggregation = 0;
export const BasicEntity = 1;
export const LoadBearingEntity = 2;

/**
 * Mock JSON-encoded DataModel definition.
 */
export const sampleDataModelJSON = { // DataModel
    id: "myTableModel",
    objects: [ // DataObject[]
        {
            id: "table",
            type: BasicEntity,
            name: "Table",
            propertySetIds: ["tablePropertySet"]
        },
        {
            id: "redLeg",
            name: "Red table leg",
            type: LoadBearingEntity,
            propertySetIds: ["tableLegPropertySet"]
        },
        {
            id: "greenLeg",
            name: "Green table leg",
            type: LoadBearingEntity,
            propertySetIds: ["tableLegPropertySet"]
        },
        {
            id: "blueLeg",
            name: "Blue table leg",
            type: LoadBearingEntity,
            propertySetIds: ["tableLegPropertySet"]
        },
        {
            id: "yellowLeg",
            name: "Yellow table leg",
            type: LoadBearingEntity,
            propertySetIds: ["tableLegPropertySet"]
        },
        {
            id: "tableTop",
            name: "Purple table top",
            type: BasicEntity,
            propertySetIds: ["tableTopPropertySet"]
        }
    ],
    relationships: [ // Relationship[]
        {
            type: BasicAggregation,
            relatingObjectId: "table",
            relatedObjectId: "tableTop"
        },
        {
            type: BasicAggregation,
            relatingObjectId: "tableTop",
            relatedObjectId: "redLeg"
        },
        {
            type: BasicAggregation,
            relatingObjectId: "tableTop",
            relatedObjectId: "greenLeg"
        },
        {
            type: BasicAggregation,
            relatingObjectId: "tableTop",
            relatedObjectId: "blueLeg"
        },
        {
            type: BasicAggregation,
            relatingObjectId: "tableTop",
            relatedObjectId: "yellowLeg"
        }
    ],
    propertySets: [ // PropertySet[]
        {
            id: "tablePropertySet",
            name: "Table properties",
            type: "",
            properties: [ // Property[]
                {
                    name: "Weight",
                    value: 5,
                    type: "",
                    valueType: "",
                    description: "Weight of the thing"
                },
                {
                    name: "Height",
                    value: 12,
                    type: "",
                    valueType: "",
                    description: "Height of the thing"
                }
            ]
        },
        {
            id: "tableLegPropertySet",
            name: "Table leg properties",
            type: "",
            properties: [
                {
                    name: "Weight",
                    value: 5,
                    type: "",
                    valueType: "",
                    description: "Weight of the thing"
                },
                {
                    name: "Height",
                    value: 12,
                    type: "",
                    valueType: "",
                    description: "Height of the thing"
                }
            ]
        },
        {
            id: "tableTopPropertySet",
            name: "Table top properties",
            type: "",
            properties: [
                {
                    name: "Weight",
                    value: 15,
                    type: "",
                    valueType: "",
                    description: "Weight of the thing"
                },
                {
                    name: "Height",
                    value: 4,
                    type: "",
                    valueType: "",
                    description: "Height of the thing"
                }
            ]
        }
    ]
};
//
// export function deepEquals(object1, object2) {
//     const keys1 = Object.keys(object1);
//     const keys2 = Object.keys(object2);
//     if (keys1.length !== keys2.length) {
//         return false;
//     }
//     for (const key of keys1) {
//         const val1 = object1[key];
//         const val2 = object2[key];
//         const areObjects = isObject(val1) && isObject(val2);
//         if (areObjects && !deepEquals(val1, val2) || !areObjects && val1 !== val2) {
//             console.log("inequality at: " + val1 + ", " + key)
//             return false;
//         }
//     }
//     return true;
// }

function isObject(object) {
    return object != null && typeof object === 'object';
}

var getClass = function (val) {
    return Object.prototype.toString.call(val).match(/^\[object\s(.*)\]$/)[1];
};

var whatis = function (val) {
    if (val === undefined)
        return 'undefined';
    if (val === null)
        return 'null';
    var type: any = typeof val;
    if (type === 'object')
        type = getClass(val).toLowerCase();
    if (type === 'number') {
        if (val.toString().indexOf('.') > 0)
            return 'float';
        else
            return 'integer';
    }
    return type;
};

var compareObjects = function (a, b) {
    if (a === b)
        return true;
    for (var i in a) {
        if (b.hasOwnProperty(i)) {
            if (!deepEquals(a[i], b[i])) {
                return false;
            }
        } else {
            return false;
        }
    }
    for (var i in b) {
        if (!a.hasOwnProperty(i)) {
            return false;
        }
    }
    return true;
};

var compareArrays = function (a, b) {
    if (a === b)
        return true;
    if (a.length !== b.length)
        return false;
    for (var i = 0; i < a.length; i++) {
        if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
};

var _equal = {};
// @ts-ignore
_equal.array = compareArrays;
// @ts-ignore
_equal.object = compareObjects;
// @ts-ignore
_equal.date = function (a, b) {
    return a.getTime() === b.getTime();
};
// @ts-ignore
_equal.regexp = function (a, b) {
    return a.toString() === b.toString();
};
//	uncoment to support function as string compare
//	_equal.fucntion =  _equal.regexp;


/*
 * Are two values equal, deep compare for objects and arrays.
 * @param a {any}
 * @param b {any}
 * @return {boolean} Are equal?
 */
export function deepEquals(a, b) {
    if (a !== b) {
        var atype = whatis(a), btype = whatis(b);

        if (atype === btype)
            return _equal.hasOwnProperty(atype) ? _equal[atype](a, b) : a == b;

        return false;
    }

    return true;
};