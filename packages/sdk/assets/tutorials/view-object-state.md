---
title: Select, Hide and Style Objects in a View
---

# Select, Hide and Style Objects in a View

This tutorial shows how to control object presentation after a model is loaded.
It builds on the minimal viewer setup and focuses on `ViewObject` state:
style-bin membership, visibility, colorization, opacity, pickability and
reset behavior.

The model owns stable `SceneObject`s. Each `View` creates a matching
`ViewObject` for every `SceneObject` that appears in the scene. The `ViewObject`
is where per-view presentation lives, which means two views can show the same
model with different style-bin membership, visibility and material overrides.

Use the `View` batch methods for toolbar, tree and search actions:

- `view.setObjectsInStyleBin("selected", ids, true)`
- `view.setObjectsVisible(ids, false)`
- `view.setObjectsInStyleBin("highlighted", ids, true)`
- `view.setObjectsInStyleBin("xrayed", ids, true)`
- `view.setObjectsColorized(ids, [1, 0.2, 0.1])`
- `view.setObjectsOpacity(ids, 0.35)`

Use `ViewObject.setStyleBin()` when you are updating one object in a small
interaction handler.

---

## 1. Start from a Loaded View

Start with a viewer that has loaded model content. The minimal viewer tutorial
creates these variables:

```javascript
const scene = new Scene();
const viewer = new Viewer({scene});
const renderer = new WebGLRenderer({viewer});
const view = must(viewer.createView({
  /* ... */
  styleBins: [
    {
      id: "selected",
      priority: 300,
      fillColor: [0.1, 0.7, 1.0],
      fillAlpha: 0.4,
      edges: true,
      edgeColor: [0.0, 0.45, 0.8]
    },
    {
      id: "highlighted",
      priority: 200,
      fillColor: [1.0, 0.85, 0.2],
      fillAlpha: 0.35,
      edges: true
    },
    {
      id: "xrayed",
      priority: 100,
      fillColor: [0.7, 0.8, 1.0],
      fillAlpha: 0.25,
      edges: true,
    }
  ]
}));
const navigation = new ModelNavigationController(view);
```

After loading a model, every loaded `SceneObject` has a matching `ViewObject` in
`view.objects`:

```javascript
const objectIds = Object.keys(view.objects);

console.log("View objects:", objectIds.length);
console.log("First object:", view.objects[objectIds[0]]);
```

The IDs are the user-facing object IDs used by picking, selection, object trees
and semantic lookup.

---

## 2. Select Objects

Select one or more objects by ID:

```javascript
view.setObjectsInStyleBin("selected", ["0hYQw7F5P7MB$zG2k9pXK3"], true);
```

Clear the current selection before selecting the next object:

```javascript
function selectOnly(objectId) {
  view.setObjectsInStyleBin("selected", view.styleBins.getObjectIds("selected"), false);

  if (objectId && view.objects[objectId]) {
    view.setObjectsInStyleBin("selected", [objectId], true);
  }
}
```

Toggle selection from an object tree row:

```javascript
function toggleSelected(objectId) {
  const viewObject = view.objects[objectId];
  if (!viewObject) {
    return;
  }
  viewObject.setStyleBin("selected", !viewObject.hasStyleBin("selected"));
}
```

Use `view.styleBins.getObjectIds()` when your UI needs to read a style-bin
set:

```javascript
console.log("Selected objects:", view.styleBins.getObjectIds("selected"));
```

---

## 3. Pick to Select

Subscribe to navigation pick events and drive view state from the picked object:

```javascript
navigation.events.onPicked.subscribe((_navigation, pickResult) => {
  const objectId = pickResult.viewObject?.id || pickResult.objectId;
  selectOnly(objectId);
});

navigation.events.onPickedNothing.subscribe(() => {
  view.setObjectsInStyleBin("selected", view.styleBins.getObjectIds("selected"), false);
});
```

If your pick result only contains `objectId`, resolve the `ViewObject` through
the current view:

```javascript
const viewObject = view.objects[pickResult.objectId];
```

Keep selection in the `View`, not in the `SceneModel`. Selection is a
presentation choice and can differ between views.

---

## 4. Highlight on Hover

Highlighting is useful for hover feedback because it can be cleared separately
from committed selection:

```javascript
let hoveredObjectId = null;

navigation.events.onHoverEnter.subscribe((_navigation, pickResult) => {
  hoveredObjectId = pickResult.viewObject?.id || pickResult.objectId;
  if (hoveredObjectId) {
    view.setObjectsInStyleBin("highlighted", [hoveredObjectId], true);
  }
});

navigation.events.onHoverOut.subscribe(() => {
  if (hoveredObjectId) {
    view.setObjectsInStyleBin("highlighted", [hoveredObjectId], false);
    hoveredObjectId = null;
  }
});
```

For a larger application, keep selection and hover state separate in your UI
store. Do not clear selected objects just because the pointer moved away.

---

## 5. Hide, Show and Isolate

Hide objects without unloading model data:

```javascript
view.setObjectsVisible(["door-14", "door-15"], false);
```

Show them again:

```javascript
view.setObjectsVisible(["door-14", "door-15"], true);
```

Isolate a set of objects by hiding everything else:

```javascript
function isolateObjects(targetIds) {
  const targetIdSet = new Set(targetIds);
  const allObjectIds = Object.keys(view.objects);
  const hiddenIds = allObjectIds.filter((id) => !targetIdSet.has(id));

  view.setObjectsVisible(allObjectIds, true);
  view.setObjectsVisible(hiddenIds, false);
  view.setObjectsInStyleBin("selected", view.styleBins.getObjectIds("selected"), false);
  view.setObjectsInStyleBin("selected", targetIds, true);
}
```

Restore all objects:

```javascript
function showAllObjects() {
  view.setObjectsVisible(Object.keys(view.objects), true);
}
```

Use visibility for user-driven show/hide state. Use culling for runtime systems
that temporarily remove objects from rendering for technical reasons.

---

## 6. X-Ray Context Around a Selection

X-ray is useful when the selected object needs surrounding context:

```javascript
function xrayEverythingExcept(targetIds) {
  const targetIdSet = new Set(targetIds);
  const allObjectIds = Object.keys(view.objects);
  const contextIds = allObjectIds.filter((id) => !targetIdSet.has(id));

  view.setObjectsInStyleBin("xrayed", allObjectIds, false);
  view.setObjectsInStyleBin("selected", view.styleBins.getObjectIds("selected"), false);
  view.setObjectsInStyleBin("xrayed", contextIds, true);
  view.setObjectsInStyleBin("selected", targetIds, true);
}
```

Clear x-ray state:

```javascript
view.setObjectsInStyleBin("xrayed", view.styleBins.getObjectIds("xrayed"), false);
```

The x-rayed appearance is controlled by the ordinary `"xrayed"` style bin
defined on this `View`. Selection and highlight appearances are likewise
controlled by application-defined `"selected"` and `"highlighted"` bins:

```javascript
view.styleBins.get("xrayed").material.fillAlpha = 0.25;
view.styleBins.get("highlighted").material.fillColor = [1, 0.8, 0.2];
```

---

## 7. Colorize and Fade Objects

Colorization applies a per-view RGB override:

```javascript
view.setObjectsColorized(["space-101", "space-102"], [0.1, 0.55, 1.0]);
```

Clear colorization with `null`:

```javascript
view.setObjectsColorized(["space-101", "space-102"], null);
```

Opacity works the same way:

```javascript
view.setObjectsOpacity(["space-101", "space-102"], 0.35);
```

Clear the opacity override with `null`:

```javascript
view.setObjectsOpacity(["space-101", "space-102"], null);
```

Use `null` to clear overrides. Setting colorize to `[1, 1, 1]` or opacity to
`1` still enables an override and can replace native material appearance.

---

## 8. Disable Picking or Clipping for Overlays

Some objects should remain visible but not participate in application picks:

```javascript
view.setObjectsPickable(["grid-overlay", "level-label"], false);
```

Some objects should ignore section planes:

```javascript
view.setObjectsClippable(["grid-overlay", "level-label"], false);
```

These are view-level interaction flags. They are useful for labels, drawings,
analysis overlays and other helper geometry that should not behave like model
elements.

---

## 9. Reset View State

Build one reset function that clears every presentation override your UI can
apply:

```javascript
function resetViewState() {
  const allObjectIds = Object.keys(view.objects);

  view.setObjectsVisible(allObjectIds, true);
  view.setObjectsInStyleBin("selected", view.styleBins.getObjectIds("selected"), false);
  view.setObjectsInStyleBin("highlighted", view.styleBins.getObjectIds("highlighted"), false);
  view.setObjectsInStyleBin("xrayed", view.styleBins.getObjectIds("xrayed"), false);
  view.setObjectsColorized(view.colorizedObjectIds, null);
  view.setObjectsOpacity(Object.keys(view.opacityObjects), null);
}
```

Call this before applying a new high-level workflow such as search result
highlighting, issue review, schedule playback or object isolation.

---

## 10. Select by Semantic Type

When you load a matching `DataModel`, semantic object IDs can drive visual state.
For example, select all objects of a known type:

```javascript
function selectObjectsByType(type) {
  const objectsByType = data.objectsByType[type] || {};
  const objectIds = Object.keys(objectsByType).filter((id) => view.objects[id]);

  view.setObjectsInStyleBin("selected", view.styleBins.getObjectIds("selected"), false);
  view.setObjectsInStyleBin("selected", objectIds, true);

  return objectIds.length;
}

selectObjectsByType("IfcWall");
```

Keep the ID policy stable during conversion or authoring. The visual
`SceneObject.id` and semantic `DataObject.id` need to match when you want a
property panel, object tree or search result to control the rendered object.

---

## Rules of Thumb

- Use `View` batch methods when updating multiple objects from UI actions.
- Use `ViewObject.setStyleBin()` for simple one-object style-bin interactions.
- Treat style-bin membership, colorize and opacity as per-view state.
- Clear colorize and opacity overrides with `null`, not neutral-looking values.
- Keep semantic lookup in `DataModel`, then apply the resulting object IDs to
  the `View`.
- Reset old state before applying a new workflow so search, isolate and hover
  behavior do not stack accidentally.
