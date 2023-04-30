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
     * BCF perspective camera.
     */
    "perspective_camera"?: BCFPerspectiveCamera;
    /**
     * BCF line segments.
     */
    "lines"?: BCFLine[];
    /**
     * BCF bitmaps.
     */
    "bitmaps"?: BCFBitmap[];
    /**
     * BCF clipping planes.
     */
    "clipping_planes"?: BCFClippingPlane[];
    /**
     * BCF snapshot.
     */
    "snapshot"?: BCFSnapshot;
    /**
     * BCF components.
     */
    "components"?: BCFComponents;
}
/**
 * BCF perspective camera.
 */
export interface BCFPerspectiveCamera {
    /**
     * BCF camera viewpoint.
     */
    "camera_view_point": BCFVector;
    /**
     * BCF camera direction.
     */
    "camera_direction": BCFVector;
    /**
     * BCF camera "up".
     */
    "camera_up_vector": BCFVector;
    /**
     * BCF camera field-of-view.
     */
    "field_of_view": number;
}
/**
 * BCF vector.
 */
export interface BCFVector {
    /**
     * BCF vector X component.
     */
    "x": number;
    /**
     * BCF vector Y component.
     */
    "y": number;
    /**
     * BCF vector Z component.
     */
    "z": number;
}
/**
 * BCF line segment.
 */
export interface BCFLine {
    /**
     * BCF line segment start point.
     */
    "start_point": BCFVector;
    /**
     * BCF line segment end point.
     */
    "end_point": BCFVector;
}
/**
 * BCF bitmap.
 */
export interface BCFBitmap {
    /**
     * BCF bitmap type.
     */
    "bitmap_type": string;
    /**
     * BCF bitmap data.
     */
    "bitmap_data": string;
    /**
     * BCF bitmap location.
     */
    "location": BCFVector;
    /**
     * BCF bitmap normal direction.
     */
    "normal": {
        "x": 0;
        "y": 0;
        "z": -1;
    };
    /**
     * BCF bitmap "up" direction.
     */
    "up": {
        "x": 0;
        "y": -1;
        "z": 0;
    };
    /**
     * BCF bitmap height.
     */
    "height": 24;
}
/**
 * BCF clipping plane.
 */
export interface BCFClippingPlane {
    /**
     * BCF clipping plane bitmap MIME type.
     */
    "bitmap_type"?: string;
    /**
     * BCF clipping plane bitmap data.
     */
    "bitmap_data"?: string;
    /**
     * BCF clipping plane location.
     */
    "location": BCFVector;
    /**
     * BCF clipping plane direction.
     */
    "normal": BCFVector;
    /**
     * BCF clipping plane "up" direction.
     */
    "up": BCFVector;
    /**
     * BCF clipping plane height.
     */
    "height": number;
}
/**
 * TODO
 */
export interface BCFSnapshot {
    "snapshot_type": "png";
    "snapshot_data": "data:image/png;base64,......";
}
/**
 * TODO
 */
export interface BCFComponents {
    "visibility"?: BCFVisibilityComponent;
    "selection"?: BCFSelectionComponent;
}
/**
 * TODO
 */
export interface BCFVisibilityComponent {
    "default_visibility": boolean;
    "exceptions": BCFComponent[];
}
/**
 * TODO
 */
export interface BCFComponent {
    "ifc_guid": string;
    "originating_system"?: string;
    "authoring_tool_id"?: string;
}
/**
 * TODO
 */
export interface BCFSelectionComponent {
    "default_selection": boolean;
    "exceptions": BCFComponent[];
}
