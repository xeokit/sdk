/**
 * # Viewer Configuration Panel
 *
 * Floating, draggable, editable panel exposing the live
 * `ViewerParams` of a {@link viewing!viewer.Viewer | Viewer} as a tree of collapsible
 * sections — one outer section per `ViewParams`, with nested
 * collapsibles per group (Camera / Effects / Lights / Materials /
 * Section Planes / Resolution Scale / Layers). Edits flow through
 * `Viewer.fromParams` so the canvas updates live.
 *
 */
export * from "./ViewerConfigPanel";
