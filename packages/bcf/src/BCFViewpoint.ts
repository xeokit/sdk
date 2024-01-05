/**
 * Represents a BIM Collaboration Format (BCF) viewpoint.
 *
 * A BCF viewpoint is a snapshot of a specific issue related to a building project, containing information such as the
 * problem description, location, and proposed solutions. It is used to facilitate communication and collaboration among
 * project stakeholders in BIM workflows.
 *
 * Conforms to <a href="https://github.com/buildingSMART/BCF-API">BCF Version 2.1</a>.
 *
 * See {@link "@xeokit/bcf"} for usage.
 *
 * [![](https://mermaid.ink/img/pako:eNrdVsGOmzAQ_RXkY7X5AY6bqqdWWinSXpbKcmCAkYxtgUmXRvn3GhtcDAZFPZYLeN7zG88wY_tOclkASUnOWdd9RVa1rMlEYh5rSV7P394RfimJQt8dMD6nREHbKcg13oDmrIGWpSP57a_5bK3LORwFdJb23Xx9_FxiV9QNUw59td8hnnNUCkVFFWezynmyvY2mkN4JI1ZLbXmXaRDoyUZJAUJPUn7oSI9VEjZxBclwCaA3kylqU2U13w1fthFege0oJcUxrVf0ZrEdWonACypL6zdNRN9coY0v300O1vwZznDGIWb8faw9_stAudOs1Yd5AFHs4GtxVwr3baVQPShIja_WFEAELphmMZjLnB2kXsi2YXwH7NUOUANWtT5OU1Cs_0NAc1fdY323G40nbOPZZMz3ZODihh1ekaMe3OL90PMDf8AXvXaZRyvupl-2osEaCihZzzVdruUqJQcmgjr_zEGN7labzLxX7UYcOMMyp1WPRSydssUKhSkAszN2Q6ehibFYr2s5Gqk2i6Rrqc2f3WQpGvwitf8e-_KASb6cTgeHSAyZpyxLOCY5blIeHQfPTnQbkMfd8NnJQc97WmB9Vio8w6LOVkdYYPJu9roljm20D6T3eisKRYTJCzF_tGFYmPuILbiM6BoayEhqPqeqy0gmHoZqSlpeBpGTtGS8gxfSK7OjwHSF8VYo0KT1x3TJGV-PP_bo0WI?type=png)](https://mermaid.live/edit#pako:eNrdVsGOmzAQ_RXkY7X5AY6bqqdWWinSXpbKcmCAkYxtgUmXRvn3GhtcDAZFPZYLeN7zG88wY_tOclkASUnOWdd9RVa1rMlEYh5rSV7P394RfimJQt8dMD6nREHbKcg13oDmrIGWpSP57a_5bK3LORwFdJb23Xx9_FxiV9QNUw59td8hnnNUCkVFFWezynmyvY2mkN4JI1ZLbXmXaRDoyUZJAUJPUn7oSI9VEjZxBclwCaA3kylqU2U13w1fthFege0oJcUxrVf0ZrEdWonACypL6zdNRN9coY0v300O1vwZznDGIWb8faw9_stAudOs1Yd5AFHs4GtxVwr3baVQPShIja_WFEAELphmMZjLnB2kXsi2YXwH7NUOUANWtT5OU1Cs_0NAc1fdY323G40nbOPZZMz3ZODihh1ekaMe3OL90PMDf8AXvXaZRyvupl-2osEaCihZzzVdruUqJQcmgjr_zEGN7labzLxX7UYcOMMyp1WPRSydssUKhSkAszN2Q6ehibFYr2s5Gqk2i6Rrqc2f3WQpGvwitf8e-_KASb6cTgeHSAyZpyxLOCY5blIeHQfPTnQbkMfd8NnJQc97WmB9Vio8w6LOVkdYYPJu9roljm20D6T3eisKRYTJCzF_tGFYmPuILbiM6BoayEhqPqeqy0gmHoZqSlpeBpGTtGS8gxfSK7OjwHSF8VYo0KT1x3TJGV-PP_bo0WI)
 */
export interface BCFViewpoint {

    /**
     * BCF orthogonal camera.
     */
    orthogonal_camera?: BCFOrthogonalCamera;

    /**
     * BCF perspective camera.
     */
    perspective_camera?: BCFPerspectiveCamera;

    /**
     * BCF line segments.
     */
    lines?: BCFLine[];

    /**
     * BCF bitmaps.
     */
    bitmaps?: BCFBitmap[];

    /**
     * BCF clipping planes.
     */
    clipping_planes?: BCFClippingPlane[];

    /**
     * BCF snapshot.
     */
    snapshot?: BCFSnapshot;

    /**
     * BCF components.
     */
    components?: BCFComponents;
}


/**
 * BCF orthogonal camera.
 */
export interface BCFOrthogonalCamera {

    /**
     * BCF orthogonal camera viewpoint.
     */
    camera_view_point: BCFVector;

    /**
     * BCF orthogonal camera direction.
     */
    camera_direction: BCFVector;

    /**
     * BCF orthogonal camera "up".
     */
    camera_up_vector: BCFVector;

    /**
     * BCF orthogonal camera view-to-world scale.
     */
    view_to_world_scale: number;

}

/**
 * BCF perspective camera.
 */
export interface BCFPerspectiveCamera {

    /**
     * BCF perspective camera viewpoint.
     */
    camera_view_point: BCFVector,

    /**
     * BCF perspective camera direction.
     */
    camera_direction: BCFVector,

    /**
     * BCF perspective camera "up".
     */
    camera_up_vector: BCFVector,

    /**
     * BCF perspective camera field-of-view.
     */
    field_of_view: number
}

/**
 * BCF vector.
 */
export interface BCFVector {

    /**
     * BCF vector X component.
     */
    x: number,

    /**
     * BCF vector Y component.
     */
    y: number,

    /**
     * BCF vector Z component.
     */
    z: number
}

/**
 * BCF line segment.
 */
export interface BCFLine {

    /**
     * BCF line segment start point.
     */
    "start_point": BCFVector,

    /**
     * BCF line segment end point.
     */
    "end_point": BCFVector
}

/**
 * BCF bitmap.
 */
export interface BCFBitmap {

    /**
     * BCF bitmap type.
     */
    bitmap_type: string,

    /**
     * BCF bitmap data.
     */
    bitmap_data: string,

    /**
     * BCF bitmap location.
     */
    location: BCFVector,

    /**
     * BCF bitmap normal direction.
     */
    normal: { x: 0, y: 0, z: -1 },

    /**
     * BCF bitmap up direction.
     */
    up: { x: 0, y: -1, z: 0 },

    /**
     * BCF bitmap height.
     */
    height: 24
}

/**
 * BCF clipping plane.
 */
export interface BCFClippingPlane {

    /**
     * BCF clipping plane bitmap MIME type.
     */
    bitmap_type?: string,

    /**
     * BCF clipping plane bitmap data.
     */
    bitmap_data?: string,

    /**
     * BCF clipping plane location.
     */
    location: BCFVector,

    /**
     * BCF clipping plane direction.
     */
    direction: BCFVector,

    /**
     * BCF clipping plane up direction.
     */
    up: BCFVector,

    /**
     * BCF clipping plane height.
     */
    height: number
}

/**
 * TODO
 */
export interface BCFSnapshot {

    /**
     * TODO
     */
    snapshot_type: "png" | "jpeg",

    /**
     * TODO
     */
    snapshot_data: string
}


/**
 * TODO
 */
export interface BCFComponents {

    /**
     * TODO
     */
    coloring: BCFColoringComponent[];

    /**
     * TODO
     */
    visibility?: BCFVisibilityComponent;

    /**
     * TODO
     */
    selection?: BCFComponent[];

    /**
     * TODO
     */
    translucency: BCFComponent[];
}

/**
 * TODO
 */
export interface BCFViewSetupHints {

    /**
     * TODO
     */
    openings_translucent: boolean;

    /**
     * TODO
     */
    space_boundaries_translucent: boolean;

    /**
     * TODO
     */
    openings_visible: boolean;

    /**
     * TODO
     */
    space_boundaries_visible: boolean;

    /**
     * TODO
     */
    spaces_translucent: boolean;

    /**
     * TODO
     */
    spaces_visible: boolean;
}

/**
 * TODO
 */
export interface BCFColoringComponent {

    /**
     * TODO
     */
    components: BCFComponent[];

    /**
     * TODO
     */
    color: string;

}

/**
 * TODO
 */
export interface BCFVisibilityComponent {

    /**
     * TODO
     */
    view_setup_hints: BCFViewSetupHints;

    /**
     * TODO
     */
    default_visibility: boolean,

    /**
     * TODO
     */
    exceptions: BCFComponent[]
}

/**
 * TODO
 */
export interface BCFTranslucencyComponent {

    /**
     * TODO
     */
    view_setup_hints: BCFViewSetupHints;

    /**
     * TODO
     */
    default_translucency: boolean,

    /**
     * TODO
     */
    exceptions: BCFComponent[]
}

/**
 * TODO
 */
export interface BCFComponent {

    /**
     * TODO
     */
    "ifc_guid": string,

    /**
     * TODO
     */
    "originating_system"?: string,

    /**
     * TODO
     */
    "authoring_tool_id"?: string
}

/**
 * TODO
 */
export interface BCFSelectionComponent {

    /**
     * TODO
     */
    default_selection: boolean,

    /**
     * TODO
     */
    exceptions: BCFComponent[]
}
