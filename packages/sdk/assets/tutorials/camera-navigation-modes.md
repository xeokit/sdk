---
title: Camera Navigation Modes
---

# Camera Navigation Modes

This tutorial shows how to choose and configure camera navigation for xeokit SDK
viewers. Camera navigation is the part of the application that turns pointer,
touch, keyboard, toolbar and saved-viewpoint input into changes on a `View`'s
`Camera`.

The important concept is that xeokit separates the camera itself from the input
controller that drives it:

- `Camera` stores the viewpoint: `eye`, `look`, `up`, active projection type and
  projection settings.
- `View` owns one `Camera` and renders one presentation of the shared `Scene`.
- `ModelNavigationController` is the general model-centric input controller. It
  supports orbit, first-person and plan-view navigation modes.
- `WalkNavigationController` is an opt-in controller for interior walkthroughs
  with floor following and obstacle checks.
- `CameraFlightAnimation` moves a camera smoothly to a target viewpoint or
  bounding box.

Most BIM and CAD viewers use more than one camera behavior. A user may orbit a
building from outside, switch to a top-down plan, double-click a component to fly
to it, then enter a walk mode for interior review. In xeokit those are not
separate viewers. They are different ways of updating the same `View.camera`.

[![Interior walk navigation example](https://xeokit.github.io/sdk/examples/sdk/view/navigation/walk-interior/index.png)](https://xeokit.github.io/sdk/examples/index.html#sdk/view/navigation/walk-interior)

The live
[Walk Navigation - Interior](https://xeokit.github.io/sdk/examples/index.html#sdk/view/navigation/walk-interior)
example shows a building interior navigated with a standard model navigation
controller and an opt-in walk controller.

---

## 1. Start with the Camera

Every `View` has a `Camera`. The camera position is defined by three world-space
vectors:

- `eye` is the camera position.
- `look` is the point the camera is looking at.
- `up` defines which direction appears upward on screen.

Create the viewer with an initial camera that fits your model's coordinate
system. For Z-up AEC models, `up: [0, 0, 1]` is the usual choice.

```javascript
import {Scene} from "@xeokit/sdk/model/scene";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";

const scene = new Scene();
const viewer = new Viewer({scene});

const viewResult = viewer.createView({
  id: "main",
  htmlElement: document.getElementById("viewerCanvas"),
  backgroundColor: [0.94, 0.96, 0.98],
  camera: {
    eye: [18, -22, 14],
    look: [0, 0, 3],
    up: [0, 0, 1]
  }
});

if (!viewResult.ok) {
  throw new Error(viewResult.error);
}

const view = viewResult.value;
const renderer = new WebGLRenderer({viewer});
```

You can also update the camera directly. Direct camera updates are useful for
toolbar buttons, saved viewpoints, generated tours and tests.

```javascript
view.camera.eye = [20, -20, 12];
view.camera.look = [0, 0, 2];
view.camera.up = [0, 0, 1];
```

---

## 2. Choose a Projection

Projection controls how the 3D scene is mapped onto the 2D canvas. Navigation
mode and projection are related, but they are not the same thing.

Use perspective projection for natural 3D inspection, orbit navigation, walk
navigation and presentation views. Use orthographic projection for plans,
elevations, sections and measurement-heavy views where parallel edges should
remain parallel.

```javascript
import {
  OrthoProjectionType,
  PerspectiveProjectionType
} from "@xeokit/sdk/base/constants";

function usePerspective(view) {
  view.camera.projectionType = PerspectiveProjectionType;
  view.camera.perspectiveProjection.fov = 55;
  view.camera.perspectiveProjection.near = 0.05;
  view.camera.perspectiveProjection.far = 10000;
}

function usePlanProjection(view, scale) {
  view.camera.projectionType = OrthoProjectionType;
  view.camera.orthoProjection.scale = scale;
  view.camera.orthoProjection.near = 0.05;
  view.camera.orthoProjection.far = 10000;
}
```

For a top-down plan, set the camera above the model and switch to orthographic
projection:

```javascript
function showTopPlan(view, center, height, scale) {
  usePlanProjection(view, scale);
  view.camera.eye = [center[0], center[1], center[2] + height];
  view.camera.look = center;
  view.camera.up = [0, 1, 0];
}
```

---

## 3. Add Model Navigation

`ModelNavigationController` is the default controller for model inspection. It
handles mouse, touch and keyboard input for one `View`. Create one controller per
interactive view.

```javascript
import {
  ModelNavigationController
} from "@xeokit/sdk/viewing/navigation/model";
import {
  OrbitNavigationMode,
  FirstPersonNavigationMode,
  PlanViewNavigationMode
} from "@xeokit/sdk/base/constants";

const modelNavigation = new ModelNavigationController(view, {
  navMode: OrbitNavigationMode,
  followPointer: true,
  doublePickFlyTo: true,
  keyboardPanRate: 4,
  keyboardDollyRate: 12,
  mouseWheelDollyRate: 90
});
```

Orbit mode is the usual starting point for BIM and CAD viewers. The camera moves
around a target point, so users can inspect an object or building while keeping
it in view.

```javascript
modelNavigation.navMode = OrbitNavigationMode;
modelNavigation.followPointer = true;
view.camera.projectionType = PerspectiveProjectionType;
```

Use first-person mode when the camera should rotate around its own `eye`
position instead of orbiting around a target point. This is useful for free
inside/outside movement without floor-following collision.

```javascript
modelNavigation.navMode = FirstPersonNavigationMode;
modelNavigation.constrainVertical = true;
view.camera.projectionType = PerspectiveProjectionType;
```

Use plan-view mode for top-down navigation. Rotation is disabled, and pointer
input behaves like pan and zoom over a drawing sheet.

```javascript
modelNavigation.navMode = PlanViewNavigationMode;
showTopPlan(view, [0, 0, 0], 120, 80);
```

---

## 4. Make Navigation Pointer-Aware

Pointer-aware navigation lets the controller use picked model geometry as
navigation context. Dollying can move toward the point under the cursor, orbiting
can pivot around the picked surface, and double-click fly-to can frame the picked
object.

Use a renderer-backed or routing picker when you want pointer-aware movement:

```javascript
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";

const picker = new RoutingPickStrategy(scene, renderer);

const modelNavigation = new ModelNavigationController(view, {
  navMode: OrbitNavigationMode,
  followPointer: true,
  doublePickFlyTo: true,
  pick: (view, pickParams) => picker.pick({
    view,
    ...pickParams
  })
});
```

If you omit `pick`, camera navigation still works. It is just less contextual:
the controller cannot use object hits and surface points to choose better dolly,
pivot and fly-to targets.

---

## 5. Fit and Fly to Targets

Applications often need camera movement that is not driven by raw pointer input:
load completion, search results, object-tree clicks, saved viewpoints and issue
links all need programmatic camera changes.

Use `CameraFlightAnimation` when the transition should be visible to the user:

```javascript
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";

const cameraFlight = new CameraFlightAnimation(view, {
  duration: 0.6
});

cameraFlight.flyTo({
  eye: [12, -16, 9],
  look: [0, 0, 2],
  up: [0, 0, 1],
  duration: 0.8,
  easing: "inThenOut"
});
```

To frame a known world-space axis-aligned bounding box, pass `aabb`:

```javascript
cameraFlight.flyTo({
  aabb: [-8, -6, 0, 8, 6, 5],
  fitFOV: 45,
  duration: 0.7
});
```

For generated tours and large-scene navigation, an arc flight can make long moves
easier to follow:

```javascript
cameraFlight.flyTo({
  eye: [40, -55, 24],
  look: [12, -10, 3],
  up: [0, 0, 1],
  arc: true,
  duration: 1.4
});
```

Use direct camera assignment instead of `CameraFlightAnimation` when the change
should be instant, such as restoring an initial view before a test capture.

---

## 6. Add Walk Navigation for Interiors

`WalkNavigationController` is for building interiors where the camera should
behave like a person. It uses scene raycasts for floor following and obstacle
checks, with parameters for eye height, body radius, walk speed, run speed, step
height and maximum fall distance.

Use it as an opt-in mode alongside `ModelNavigationController`. Pass the standard
controller as `suspendModelNavigationController` so only one controller handles
movement while walk mode is active.

```javascript
import {WalkNavigationController} from "@xeokit/sdk/viewing/navigation/walk";

const walkNavigation = new WalkNavigationController(view, {
  active: false,
  suspendModelNavigationController: modelNavigation,
  eyeHeight: 1.65,
  bodyRadius: 0.32,
  walkSpeed: 4.0,
  runSpeed: 8.5,
  stepHeight: 0.35,
  maxFall: 1.0,
  keyboardEnabledOnlyOnMouseover: false
});

function enterWalkMode(startEye, startLook) {
  view.camera.projectionType = PerspectiveProjectionType;
  view.camera.eye = startEye;
  view.camera.look = startLook;
  view.camera.up = [0, 0, 1];
  walkNavigation.active = true;
}

function leaveWalkMode() {
  walkNavigation.active = false;
  modelNavigation.navMode = OrbitNavigationMode;
}
```

For production interiors, use `obstacleFilter` and `walkSurfaceFilter` to decide
which objects block the user and which objects count as walkable floors. This
keeps furniture, ceilings, annotations or temporary overlays from becoming
unwanted navigation geometry.

```javascript
const walkNavigation = new WalkNavigationController(view, {
  active: false,
  suspendModelNavigationController: modelNavigation,
  obstacleFilter: (objectId) => !objectId.startsWith("annotation-"),
  walkSurfaceFilter: (objectId) => objectId.includes("Floor")
});
```

---

## 7. Save and Restore Viewpoints

A saved viewpoint should record both view direction and projection. At minimum,
store `eye`, `look`, `up`, `projectionType` and the active projection settings
you care about.

```javascript
function saveViewpoint(view) {
  return {
    eye: Array.from(view.camera.eye),
    look: Array.from(view.camera.look),
    up: Array.from(view.camera.up),
    projectionType: view.camera.projectionType,
    orthoScale: view.camera.orthoProjection.scale,
    perspectiveFOV: view.camera.perspectiveProjection.fov
  };
}

function restoreViewpoint(view, viewpoint) {
  view.camera.projectionType = viewpoint.projectionType;
  view.camera.orthoProjection.scale = viewpoint.orthoScale;
  view.camera.perspectiveProjection.fov = viewpoint.perspectiveFOV;
  view.camera.eye = viewpoint.eye;
  view.camera.look = viewpoint.look;
  view.camera.up = viewpoint.up;
}
```

For BIM Collaboration Format workflows, use the SDK's BCF viewpoint helpers
instead of inventing a custom interchange format:

```javascript
import {
  saveBCFViewpoint,
  loadBCFViewpoint
} from "@xeokit/sdk/interop/bcf";

const bcfResult = saveBCFViewpoint({view});

if (!bcfResult.ok) {
  throw new Error(bcfResult.error);
}

loadBCFViewpoint({
  view,
  data,
  bcfViewpoint: bcfResult.value
});
```

BCF viewpoints can include camera state, section planes and component
visibility/selection/coloring state, making them a better choice for issue
exchange than a camera-only bookmark.

---

## 8. Switch Modes from UI State

Keep one authoritative application state for the active navigation mode, then
apply the camera projection and controller state from that mode. This avoids
leaving walk navigation active while also enabling orbit controls, or staying in
orthographic projection after switching back to a 3D mode.

```javascript
function setNavigationMode(mode) {
  walkNavigation.active = false;
  modelNavigation.active = true;

  if (mode === "orbit") {
    view.camera.projectionType = PerspectiveProjectionType;
    modelNavigation.navMode = OrbitNavigationMode;
    modelNavigation.followPointer = true;
    return;
  }

  if (mode === "firstPerson") {
    view.camera.projectionType = PerspectiveProjectionType;
    modelNavigation.navMode = FirstPersonNavigationMode;
    modelNavigation.constrainVertical = true;
    return;
  }

  if (mode === "plan") {
    modelNavigation.navMode = PlanViewNavigationMode;
    showTopPlan(view, [0, 0, 0], 120, 80);
    return;
  }

  if (mode === "walk") {
    view.camera.projectionType = PerspectiveProjectionType;
    modelNavigation.active = false;
    walkNavigation.active = true;
  }
}
```

The controller choice should follow the user's task:

| User task | Recommended camera behavior |
| --- | --- |
| General model inspection | `ModelNavigationController` with `OrbitNavigationMode` |
| Drawing-like plan review | `PlanViewNavigationMode` with `OrthoProjectionType` |
| Free camera movement | `FirstPersonNavigationMode` with perspective projection |
| Interior walkthrough | `WalkNavigationController` |
| Search result, object-tree click or issue link | `CameraFlightAnimation.flyTo()` |
| Saved issue exchange | BCF viewpoint helpers |

---

## 9. Clean Up Controllers

Destroy controllers when a view is removed or the application tears down the
viewer. This releases event handlers and restores any controller that walk mode
temporarily suspended.

```javascript
walkNavigation.destroy();
modelNavigation.destroy();
renderer.destroy();
viewer.destroy();
scene.destroy();
```

Use the same rule for multi-view applications: each `View` gets its own camera
and its own navigation controllers, even when all views share the same `Scene`.
