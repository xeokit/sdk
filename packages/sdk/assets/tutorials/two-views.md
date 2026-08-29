---
title: View a Model in Two Views
---

# View a Model in Two Views

This tutorial shows how to display one loaded model in two views at the same
time. The pattern is useful for split-screen BIM and CAD workflows: a 3D
perspective view beside a plan view, a close-up beside an overview, or two
independent cameras comparing different parts of the same model.

The important concept is that xeokit separates model data from presentation:

- `Scene` owns the actual model content: geometry, materials, transforms and
  `SceneObject` instances.
- `Viewer` owns one attached `Scene` and coordinates the interactive browser
  views of that scene.
- `View` is a presentation of the shared scene into one HTML element. Each view
  has its own `Camera`, lighting, effects, section planes and `ViewObject` state.
- `ViewObject` wraps one shared `SceneObject` for one view. That means the same
  model object can be highlighted, hidden, selected or colored differently in
  each view.
- `Renderer` paints the viewer's views. With one viewer and two views, one
  renderer can render both canvases from the same scene.

The model is loaded once into the `Scene`. Both views see it because both views
belong to the same `Viewer`. Camera movement and object emphasis can be kept
independent, or you can explicitly synchronize them when your application needs
linked panes.

[![Sports car XGF model displayed in multiple views](https://xeokit.github.io/sdk/examples/import/xgf/sports-car/index.png)](https://xeokit.github.io/sdk/examples/index.html#import/xgf/sports-car)

The live
[XGF Sports Car - Multiple Views](https://xeokit.github.io/sdk/examples/index.html#import/xgf/sports-car)
example shows the same shared-scene pattern with an XGF model rendered into
multiple views.

---

## 1. Add Two Canvases

Create a page with two side-by-side canvas elements:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>xeokit Two Views</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      #views {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      @media (max-width: 800px) {
        #views {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div id="views">
      <canvas id="perspectiveCanvas"></canvas>
      <canvas id="planCanvas"></canvas>
    </div>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
```

Each canvas becomes the `htmlElement` for one xeokit `View`.

---

## 2. Create One Scene, One Viewer and Two Views

Create `viewer.js` and initialize the shared scene:

```javascript
import {Scene} from "@xeokit/sdk/model/scene";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {OrthoProjectionType} from "@xeokit/sdk/base/constants";

const MODEL_URL = "./models/house-plan/model.xgf";

main().catch((error) => {
  console.error(error);
});

async function main() {
  const scene = new Scene();
  const viewer = new Viewer({scene});

  const perspectiveView = must(viewer.createView({
    id: "perspective",
    htmlElement: document.getElementById("perspectiveCanvas"),
    backgroundColor: [0.93, 0.95, 0.98],
    camera: {
      eye: [14, -18, 12],
      look: [0, 0, 3],
      up: [0, 0, 1]
    }
  }));

  const planView = must(viewer.createView({
    id: "plan",
    htmlElement: document.getElementById("planCanvas"),
    backgroundColor: [0.98, 0.98, 0.96],
    camera: {
      eye: [0, 0, 80],
      look: [0, 0, 0],
      up: [0, 1, 0],
      projectionType: OrthoProjectionType,
      orthoProjection: {
        scale: 50
      }
    }
  }));

  const renderer = new WebGLRenderer({viewer});

  new ModelNavigationController(perspectiveView);
  new ModelNavigationController(planView);

  await loadModel(scene);

  window.twoViewDemo = {
    scene,
    viewer,
    renderer,
    perspectiveView,
    planView
  };
}

async function loadModel(scene) {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${MODEL_URL}`);
  }

  const sceneModel = must(scene.createModel({
    id: "house-plan",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  }));

  await new XGFLoader().load({
    fileData: await response.arrayBuffer(),
    sceneModel
  });
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
```

The model is loaded once into `scene`. When objects are added to the scene, the
viewer attaches them to both views.

---

## 3. Understand Independent View State

Both views render the same `SceneObject` instances, but each view has its own
`ViewObject` wrappers. That is why the same object can be selected in one view
without being selected in the other.

```javascript
function selectOnlyInPlanView(objectId, planView) {
  const planObject = planView.objects[objectId];
  if (planObject) {
    planObject.selected = true;
    planObject.highlighted = false;
  }
}

function highlightOnlyInPerspectiveView(objectId, perspectiveView) {
  const perspectiveObject = perspectiveView.objects[objectId];
  if (perspectiveObject) {
    perspectiveObject.highlighted = true;
    perspectiveObject.selected = false;
  }
}
```

Use this for workflows where the overview pane shows context while the detail
pane shows active selection or markup.

---

## 4. Link Cameras When Needed

The two cameras are independent by default. To keep the plan view centered on the
perspective view's target, subscribe to camera updates and copy the `look`
position.

```javascript
function linkPlanToPerspective(viewer, perspectiveView, planView) {
  const syncPlan = (changedView) => {
    if (changedView !== perspectiveView) {
      return;
    }
    const look = perspectiveView.camera.look;
    planView.camera.look = [look[0], look[1], 0];
    planView.camera.eye = [look[0], look[1], 80];
    planView.camera.up = [0, 1, 0];
  };

  viewer.events.onCameraViewMatrixUpdated.subscribe(syncPlan);
}
```

Call it after both views are created:

```javascript
linkPlanToPerspective(viewer, perspectiveView, planView);
```

For fully independent views, do not install this synchronization handler.

---

## 5. Pick in One View and Update the Other

Picking is view-scoped because the canvas position and camera are view-specific.
You can still use a pick in one view to update object state in another view.

```javascript
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";

// Add this next to the other imports in viewer.js.
const picker = new RoutingPickStrategy(scene, renderer);

perspectiveView.htmlElement.addEventListener("click", (event) => {
  const rect = perspectiveView.htmlElement.getBoundingClientRect();
  const result = picker.pick({
    view: perspectiveView,
    canvasPos: [
      event.clientX - rect.left,
      event.clientY - rect.top
    ]
  });

  if (!result.hit || !result.objectId) {
    return;
  }

  const objectInPlan = planView.objects[result.objectId];
  if (objectInPlan) {
    objectInPlan.selected = true;
  }
});
```

This is the usual pattern for coordinated panes: the interaction happens in one
view, while the resulting object ID is applied to whichever other views need to
react.

---

## 6. Resize

The views use their `htmlElement` dimensions when rendering. Keep those elements
stable in your layout, and let the viewer and renderer react to camera, scene and
view-state changes.

```javascript
window.addEventListener("resize", () => {
  // Update any surrounding application layout here if needed.
});
```

The renderer owns GPU resources for the shared scene, while each view contributes
its own camera, canvas dimensions and render state.

---

## 7. When to Use Two Viewers Instead

Use one `Viewer` with multiple `View` instances when both panes should show the
same scene with different cameras or per-view emphasis state. This is the most
direct setup for split view, overview/detail, plan/3D and comparison layouts.

Use two `Viewer` instances only when the panes need separate scenes or separate
renderers, for example comparing WebGL against WebGPU, loading different models,
or isolating renderer configuration. In that case, each viewer owns its own view
list and renderer attachment, even if both viewers reference the same underlying
`Scene`.
