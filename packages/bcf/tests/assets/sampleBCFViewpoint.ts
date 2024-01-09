import {type BCFViewpoint} from "../../src";

/**
 * Sample simple BCF viewpoint
 */
 export const sampleBCFViewpoint:BCFViewpoint = {
    "components": {
        "coloring": [
            {
                "color": "66000000",
                "components": [
                    {
                        "ifc_guid": "tableTop"
                    }
                ]
            },
            {
                "color": "ff00ff",
                "components": [
                    {
                        "ifc_guid": "greenLeg"
                    }
                ]
            }
        ],
        "selection": [
            {
                "ifc_guid": "greenLeg"
            }
        ],
        "translucency": [
            {
                "ifc_guid": "tableTop"
            }
        ],
        "visibility": {
            "default_visibility": true,
            "exceptions": [
                {
                    "ifc_guid": "redLeg"
                }
            ],
            "view_setup_hints": {
                "openings_translucent": false,
                "openings_visible": false,
                "space_boundaries_translucent": false,
                "space_boundaries_visible": false,
                "spaces_translucent": false,
                "spaces_visible": false
            }
        }
    },
    "perspective_camera": {
        "camera_direction": {
            "x": 0.5692099788303082,
            "y": 0.758946638440411,
            "z": -0.3162277660168379
        },
        "camera_up_vector": {
            "x": 0.18,
            "y": 0.25,
            "z": 0.93
        },
        "camera_view_point": {
            "x": -10.0,
            "y": -24.0,
            "z": 12.0
        },
        "field_of_view": 60
    },
    "snapshot": {
        "snapshot_data": {},
        "snapshot_type": "png"
    }
};