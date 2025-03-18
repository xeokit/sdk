import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates wireframe vector text as a {@link scene!SceneGeometry | SceneGeometry}.
 *
 * This function generates the geometry data for rendering text as a wireframe. Each character is represented as a series of lines, with the position of each vertex specified in 3D space. The text is provided as input, and the function constructs the wireframe representation for each character. The resulting geometry can be used for rendering text in 3D environments.
 *
 * ## Usage
 *
 * To create wireframe vector text geometry, simply call the function and pass the appropriate configuration object. For example:
 *
 * ```javascript
 * const textGeometry = buildVectorTextGeometry({
 *     size: 2,
 *     origin: [0, 0, 0],
 *     text: "Hello, World!"
 * });
 * ```
 *
 * This creates a wireframe mesh for the text "Hello, World!" with each character sized at 2 units, centered at the origin.
 *
 * ## Parameters:
 * @param cfg Configuration object for generating the text geometry.
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link scene!Scene | Scene}. If omitted, an ID is generated automatically.
 * @param [cfg.center] A 3D point (array of 3 numbers) indicating the center position of the geometry. If omitted, the default is [0, 0, 0].
 * @param [cfg.origin] A 3D point (array of 3 numbers) indicating the top-left corner of the text in the 3D space. This sets the initial position for the first character of the text.
 * @param [cfg.size=1] The size of each character in the text. Default is 1.
 * @param [cfg.text=""] The text string to display. It can include multiple lines (using `\n`).
 *
 * ## Returns:
 * Returns a {@link scene!SceneGeometry | SceneGeometry} object with the wireframe representation of the provided text, including the necessary positions, indices, and primitive type for rendering.
 *
 * ## Example:
 * ````javascript
 * const textGeometry = buildVectorTextGeometry({
 *     size: 1.5,
 *     origin: [0, 0, 0],
 *     text: "Sample Text"
 * });
 * ````
 *
 * ## Notes:
 * - The function assumes that the characters are defined in a pre-existing `letters` object, where each character is mapped to its wireframe geometry (points and width).
 * - The geometry is created by breaking down each character into a series of points, connecting those points with lines to form the wireframe.
 * - The `size` parameter scales the text, and the `mag` constant adjusts the scaling factor for the points' positions.
 *
 * @returns {GeometryArrays} The geometry data for the wireframe vector text.
 */
export declare function buildVectorTextGeometry(cfg?: {
    size: number;
    origin: number[];
    text: string;
}): GeometryArrays;
//# sourceMappingURL=buildVectorTextGeometry.d.ts.map