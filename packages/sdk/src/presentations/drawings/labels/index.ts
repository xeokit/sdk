/**
 * Label-emission helpers for {@link buildDrawing}. Phase 1 of
 * the labelling system surfaces room-name labels placed inside
 * each space's projected fill polygon at its pole of
 * inaccessibility; future phases add object tags with leader
 * lines, dimension strings, grid bubbles, and level markers.
 *
 * @module drawings/labels
 */
export * from "./SpaceLabelSpec";
export * from "./computeLabelPlacement";
