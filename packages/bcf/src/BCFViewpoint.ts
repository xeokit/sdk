import {BCFOrthogonalCamera} from "./BCFOrthogonalCamera";
import {BCFPerspectiveCamera} from "./BCFPerspectiveCamera";
import {BCFLine} from "./BCFLine";
import {BCFBitmap} from "./BCFBitmap";
import {BCFClippingPlane} from "./BCFClippingPlane";
import {BCFSnapshot} from "./BCFSnapshot";
import {BCFComponents} from "./BCFComponents";

/**
 * Represents a BIM Collaboration Format (BCF) viewpoint.
 *
 * A BCF viewpoint is a snapshot of a specific issue related to a building project, containing information such as the
 * problem description, location, and proposed solutions. It is used to facilitate communication and collaboration among
 * project stakeholders in BIM workflows.
 *
 * Conforms to <a href="https://github.com/buildingSMART/BCF-API">BCF Version 2.1</a>.
 *
 * See {@link "@xeokit/bcf" | @xeokit/bcf} for usage.
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


