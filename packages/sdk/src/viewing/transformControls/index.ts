/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="../../assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Transform Controls
 *
 * ---
 *
 * ***Translate / rotate / scale handles with hover highlight, snap,
 * screen-space sizing, and the view-aligned `E` and `XYZE` rings.***
 *
 * ---
 *
 * ## Overview
 *
 * The `transformControls` module exposes a familiar transform-gizmo
 * UX through a xeokit-idiomatic API:
 *
 * - **Three modes** — `"translate" | "rotate" | "scale"`, plus `"none"`
 *   to hide the rig without detaching.
 * - **Two coordinate spaces** — `"world"` (world axes) or `"local"`
 *   (target's own rotation).
 * - **All handle groups** —
 *     axis arrows + plane handles + centre free-move (translate);
 *     three axis rings + view-aligned `E` ring + view-aligned `XYZE`
 *     trackball (rotate);
 *     axis sticks with cube ends + plane handles + centre uniform-scale
 *     handle (scale).
 * - **Hover highlight** — the handle under the pointer turns yellow.
 * - **Snap setters** — `setTranslationSnap`, `setRotationSnap`,
 *   `setScaleSnap` quantise drag deltas.
 * - **Screen-space sizing** — the rig stays a constant pixel size on
 *   screen regardless of camera distance.
 * - **showX / showY / showZ** — hide any axis group.
 *
 * <br>
 *
 * ## Quick Start
 *
 * ````ts
 * import { TransformControls } from "@xeokit/sdk/viewing/transformControls";
 *
 * const controls = new TransformControls({
 *   view,
 *   size: 160,                  // pixels on-screen
 * });
 *
 * controls.attach(scene.objects["myObject"]);
 *
 * controls.events.onDragStart.subscribe(() => console.log("drag started"));
 * controls.events.onDragEnd.subscribe(()   => console.log("drag ended"));
 * controls.events.onObjectChange.subscribe(() => console.log("target moved"));
 *
 * // Keyboard shortcuts:
 * window.addEventListener("keydown", (e) => {
 *   if (e.key === "g") controls.setMode("translate");
 *   if (e.key === "r") controls.setMode("rotate");
 *   if (e.key === "s") controls.setMode("scale");
 *   if (e.key === "q") controls.setSpace(controls.space === "world" ? "local" : "world");
 *   if (e.key === "+") controls.setSize(controls.size + 10);
 *   if (e.key === "-") controls.setSize(controls.size - 10);
 *   if (e.key === "x") controls.setShowX(!controls.showX);
 *   if (e.key === "y") controls.setShowY(!controls.showY);
 *   if (e.key === "z") controls.setShowZ(!controls.showZ);
 * });
 *
 * // Snap to 1-unit translation steps and 15° rotation steps.
 * controls.setTranslationSnap(1);
 * controls.setRotationSnap(Math.PI / 12);
 * controls.setScaleSnap(0.1);
 * ````
 *
 * @module transformControls
 */

export * from "./TransformControls";
export * from "./TransformControlsAxis";
export * from "./TransformControlsDragEvent";
export * from "./TransformControlsEvents";
export * from "./TransformControlsMode";
export * from "./TransformControlsParams";
export * from "./TransformControlsSpace";
export * from "./TransformControlsTarget";
