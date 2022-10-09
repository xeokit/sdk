/**
 * Default initial properties for objects for given types.
 */
export const IFCObjectDefaults = {

    IfcOpeningElement: {
        pickable: false,
        visible: false
    },

    IfcSpace: {
        colorize: [0.137255, 0.403922, 0.870588],
        pickable: false,
        visible: false,
        opacity: 0.4
    },

    IfcWindow: {
        colorize: [0.137255, 0.403922, 0.870588],
        opacity: 0.3
    },

    IfcPlate: {
        colorize: [0.8470588235, 0.427450980392, 0, 0.5],
        opacity: 0.3
    },

    DEFAULT: {
    }
};
