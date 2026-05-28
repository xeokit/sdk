/**
 * <img style="padding:10px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # xeokit Studio
 *
 * ---
 *
 * **Demo scaffold that wires the SDK's renderer, scene, data, viewer
 * and stock UI into one object — boots a working 3D demo in a few
 * lines.**
 *
 * ---
 *
 * @module studio
 */

export * from "./Studio";
export * from "./LoadingSpinner";
export * as menus from "./contextMenus";
export * from "./loading";
export * from "./viewManager";
export * as picking from "./picking";
export * as panels from "./panels";
export *  as dialogs from "./dialogs";
export * as systems from "./systems";
export * as sectionPlanesTool from "./systems/sectionPlanesTool";
export type {StudioCreateViewParams} from "./StudioCreateViewParams";
