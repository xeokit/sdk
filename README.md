# xeokit-viewer

[![This project is using Percy.io for visual regression testing.](https://percy.io/static/images/percy-badge.svg)](https://percy.io/73524691/xeokit-viewer)
[![npm version](https://badge.fury.io/js/%40xeokit%2Fxeokit-webgpu-sdk.svg)](https://badge.fury.io/js/%40xeokit%2Fxeokit-webgpu-sdk)
[![](https://data.jsdelivr.com/v1/package/npm/@xeokit/xeokit-viewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/xeokit-viewer)

[xeokit](http://xeokit.io) is a JavaScript software development kit from [xeolabs](http://xeolabs.com) for viewing
high-detail, full-precision 3D engineering and BIM models in the browser.
<br><br>

# Status 

This project is work-in-progress and should be ready to try in the third quarter of 2022. So far, we're just releasing a preview of the API documentation to given developers an idea of what to expect.

# Concepts

The [Viewer](https://xeokit.github.io/xeokit-viewer/docs/classes/Viewer.html) class is the core component of xeokit-viewer. The Viewer has the following
components:

- A [Scene](https://xeokit.github.io/xeokit-viewer/docs/classes/Scene.html) containing [SceneModels](https://xeokit.github.io/xeokit-viewer/docs/classes/SceneModel.html)
  and [SceneObjects](https://xeokit.github.io/xeokit-viewer/docs/classes/SceneObject.html), which define the geometry and materials of our models.
- A [Data](https://xeokit.github.io/xeokit-viewer/docs/classes/SceneData.html) containing [DataModels](https://xeokit.github.io/xeokit-viewer/docs/classes/DataModel.html)
  and [DataObjects](https://xeokit.github.io/xeokit-viewer/docs/classes/DataObject.html), which describe the semantics and structure of our models.
- One or more [Views](https://xeokit.github.io/xeokit-viewer/docs/classes/View.html), that each create an independent view of the Scene. Each View has its own
  canvas, [Camera](https://xeokit.github.io/xeokit-viewer/docs/classes/Camera.html), and [ViewObjects](https://xeokit.github.io/xeokit-viewer/docs/classes/ViewObject.html), which define the
  appearance of each SceneObject in that particular View.
- A [LocaleService](https://xeokit.github.io/xeokit-viewer/docs/classes/LocaleService.html) that provides locale translations for UI elements.

A key goodness of this architecture is [*separation of concerns*](https://en.wikipedia.org/wiki/Separation_of_concerns),
where we have separate data structures for metadata, geometry and views. This decouples the metadata from the scene
representation, allowing the possibility to have more types of metadata structure in the future.

## Multiple Views

Another goodness is the decoupling of scene content from presentation, which allows us to define multiple, independent
views of the scene, without duplicating scene content. Each view can be completely unique; one view could have a main
canvas that shows a 3D perspective view for a first-person walk-through, while another view could have a small canvas
that shows a 2D plan view of a selected storey, showing the location of the user's viewpoint in the main view.

## Usage

### Example 1

Let's create a [Viewer](https://xeokit.github.io/xeokit-viewer/docs/classes/Viewer.html) with a [WebIFCLoaderPlugin](https://xeokit.github.io/xeokit-viewer/docs/classes/WebIFCLoaderPlugin.html)
to view a IFC model in the browser. We'll configure our Viewer with two [Views](https://xeokit.github.io/xeokit-viewer/docs/classes/View.html), and a then view
a sample IFC model from the [Open IFC Model Database](http://openifcmodel.cs.auckland.ac.nz/Model/Details/274).

![](https://xeokit.io/img/docs/WebIFCLoaderPlugin/WebIFCLoaderPluginBig.png)

````html
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>xeokit Example</title>
    <style>
        body {
            margin: 0;
            width: 100%;
            height: 100%;
            user-select: none;
        }

        #myCanvas1 {
            width: 70%;
            height: 100%;
            position: absolute;
            background: lightblue;
            background-image: linear-gradient(lightblue, white);
        }

        #myCanvas2 {
            width: 30%;
            height: 100%;
            position: absolute;
            background: white;
        }
    </style>
</head>
<body>
<canvas id="myCanvas1"></canvas>
<canvas id="myCanvas2"></canvas>
</body>
<script id="source" type="module">

    import {Viewer, 
      View, WebIFCLoaderPlugin} from
                "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";

    // Create a Viewer with two Views
    
    const viewer = new Viewer();

    const view1 = new View(viewer, {
        canvasId: "myCanvas1"
    });

    view1.camera.eye = [-3.933, 2.855, 27.018];
    view1.camera.look = [4.400, 3.724, 8.899];
    view1.camera.up = [-0.018, 0.999, 0.039];
    view1.camera.projection = "perspective";
    view1.cameraControl.navMode = "orbit";

    const view2 = new View(viewer, {
        canvasId: "myCanvas2"
    });

    view2.camera.eye = [-3.933, 2.855, 27.018];
    view2.camera.look = [4.400, 3.724, 8.899];
    view2.camera.up = [-0.018, 0.999, 0.039];
    view2.camera.projection = "ortho";
    
    view2.cameraControl.navMode = "planView";

    // Load a model from IFC
    
    const webIFCLoader = new WebIFCLoaderPlugin(viewer, {
        wasmPath: "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/"
    });

    const sceneModel = webIFCLoader.load({
        id: "myModel",
        src: "Duplex.ifc"
    });
    
    // Click the View #1 canvas to pick ViewObjects
    
    view1.input.events.on("click", (mouseCanvasPos) => {
    
        const pickResult = view1.pick({
            canvasPos: mouseCanvasPos
        });

        if (pickResult) {

            // Picked a ViewObject

            const viewObject = pickResult.viewObject;

            // Get geometry of the picked ViewObject

            const sceneObject = viewer.scene.sceneObjects[viewObject.id];
            const aabb = sceneObject.aabb; // 3D axis-aligned boundary
            const center = sceneObject.center; // 3D center

            // Get metadata for the picked ViewObject

            const dataObject = viewer.data.dataObjects[viewObject.id];

            if (dataObject) {

                const name = dataObject.name;
                const type = dataObject.type; // Eg. "IfcWall", "IfcBuildingStorey"

                for (let propertySet of dataObject.propertySets) {

                    const propertySetId = propertySet.id;
                    const propertySetName = propertySet.name;
                    const propertySetType = propertySet.type;

                    for (let property of propertySet) {

                        const propertyId = property.id;
                        const propertyName = property.name;
                        const propertyType = property.type;

                        //...
                    }
                }

                const dataModel = dataObject.dataModel;

                const projectId = dataModel.projectId;
                const revisionId = dataModel.revisionId;
                const author = dataModel.author;
                const createdAt = dataModel.createdAt;
                const creatingApplication = dataModel.creatingApplication;
                const schema = dataModel.schema;

                //...
            }
        }
    });

</script>
</html>
````

### Example 2

Let's go a little deeper and build some content directly within a [Viewer](https://xeokit.github.io/xeokit-viewer/docs/classes/Viewer.html) using its
JavaScript API.

In our second example, we'll create a Viewer with two [Views](https://xeokit.github.io/xeokit-viewer/docs/classes/View.html) like before, but this time we'll
create our model metadata and geometry programmatically, using builder methods within the API.

![](http://xeokit.io/img/docs/sceneGraph.png)

````html
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>xeokit Example</title>
    <style>
        body {
            margin: 0;
            width: 100%;
            height: 100%;
            user-select: none;
        }

        #myCanvas1 {
            width: 70%;
            height: 100%;
            position: absolute;
            background: lightblue;
            background-image: linear-gradient(lightblue, white);
        }

        #myCanvas2 {
            width: 30%;
            height: 100%;
            position: absolute;
            background: white;
        }
    </style>
</head>
<body>
<canvas id="myCanvas1"></canvas>
<canvas id="myCanvas2"></canvas>
</body>
<script id="source" type="module">

    import {Viewer, View} from
                "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";

    const viewer = new Viewer();

    // Create a couple of independent views

    const view1 = new View(viewer, {
        canvasId: "myCanvas1"
    });

    view1.camera.eye = [-3.933, 2.855, 27.018];
    view1.camera.look = [4.400, 3.724, 8.899];
    view1.camera.up = [-0.018, 0.999, 0.039];
    view1.camera.projection = "perspective";
    view1.cameraControl.navMode = "orbit";

    const view2 = new View(viewer, {
        canvasId: "myCanvas2"
    });

    view2.camera.eye = [-3.933, 2.855, 27.018];
    view2.camera.look = [4.400, 3.724, 8.899];
    view2.camera.up = [-0.018, 0.999, 0.039];
    view2.camera.projection = "ortho";
    view2.cameraControl.navMode = "planView";

    const scene = viewer.scene;

    // Create model metadata

    const dataModel = viewer.data.createDataModel("myTableModel", {
        projectId: "024120003",
        revisionId: "902344223",
        author: "xeolabs",
        createdAt: "Jan 26 2022",
        creatingApplication: "WebStorm",
        schema: "ifc4",
        propertySets: [
            {
                id: "tablePropertySet";
                originalSystemId: "tablePropertySet";
                name: "Table properties";
                type: "";
                properties: [
                    {
                        name: "Weight",
                        value: 5,
                        type: "",
                        valueType: "",
                        description: "Weight of the thing"
                    },
                    {
                        name: "Height",
                        value: 12,
                        type: "",
                        valueType: "",
                        description: "Height of the thing"
                    }
            },
            {
                id: "legPropertySet";
                originalSystemId: "legPropertySet";
                name: "Table leg properties";
                type: "";
                properties: [
                    {
                        name: "Weight",
                        value: 5,
                        type: "",
                        valueType: "",
                        description: "Weight of the thing"
                    },
                    {
                        name: "Height",
                        value: 12,
                        type: "",
                        valueType: "",
                        description: "Height of the thing"
                    }
            }
        ],
        objects: [
            {
                id: "table",
                originalSystemId: "table",
                type: "furniture",
                name: "Table",
                propertySetIds: ["tablePropertySet"]
            },
            {
                id: "redLeg",
                name: "Red table Leg",
                type: "leg",
                parent: "table",
                propertySetIds: ["tableLegPropertySet"]
            },
            {
                id: "greenLeg",
                name: "Green table leg",
                type: "leg",
                parent: "table",
                propertySetIds: ["tableLegPropertySet"]
            },
            {
                id: "blueLeg",
                name: "Blue table leg",
                type: "leg",
                parent: "table",
                propertySetIds: ["tableLegPropertySet"]
            },
            {
                id: "yellowLeg",
                name: "Yellow table leg",
                type: "leg",
                parent: "table",
                propertySetIds: ["tableLegPropertySet"]
            },
            {
                id: "tableTop",
                name: "Purple table top",
                type: "surface",
                parent: "table",
                propertySetIds: ["tableTopPropertySet"]
            }
        ]
    });

    // Create model scene representation

    const sceneModel = viewer.scene.createSceneModel({
        id: "myTable",
        position: [0, 0, 0],
        scale: [1, 1, 1],
        rotation: [0, 0, 0]
    });

    sceneModel.createGeometry({
        id: "myBoxGeometry",
        primitive: "triangles", // "points", "lines" or "triangles"
        positions: [
            1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, // v0-v1-v2-v3 front
            1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, // v0-v3-v4-v1 right
            1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, // v0-v1-v6-v1 top
            -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, // v1-v6-v7-v2 left
            -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,// v7-v4-v3-v2 bottom
            1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1 // v4-v7-v6-v1 back
        ],
        normals: [
            0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,// v0-v1-v2-v3 front
            1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,// v0-v3-v4-v5 right
            0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,// v0-v5-v6-v1 top
            -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,// v1-v6-v7-v2 left
            0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,// v7-v4-v3-v2 bottom
            0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1// v4-v7-v6-v5 back
        ],
        indices: [
            0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
        ]
    });

    // Red table leg object

    sceneModel.createMesh({
        id: "redLegMesh",
        geometryId: "myBoxGeometry",
        position: [-4, -6, -4],
        scale: [1, 3, 1],
        rotation: [0, 0, 0],
        color: [1, 0.3, 0.3]
    });

    sceneModel.createSceneObject({
        id: "redLeg",
        meshIds: ["redLegMesh"]
    });

    // Green table leg object

    sceneModel.createMesh({
        id: "greenLegMesh",
        geometryId: "myBoxGeometry",
        position: [4, -6, -4],
        scale: [1, 3, 1],
        rotation: [0, 0, 0],
        color: [0.3, 1.0, 0.3]
    });

    sceneModel.createSceneObject({
        id: "greenLeg",
        meshIds: ["greenLegMesh"]
    });

    // Blue table leg

    sceneModel.createMesh({
        id: "blueLegMesh",
        geometryId: "myBoxGeometry",
        position: [4, -6, 4],
        scale: [1, 3, 1],
        rotation: [0, 0, 0],
        color: [0.3, 0.3, 1.0]
    });

    sceneModel.createSceneObject({
        id: "blueLeg",
        meshIds: ["blueLegMesh"]
    });

    // Yellow table leg

    sceneModel.createMesh({
        id: "yellowLegMesh",
        geometryId: "myBoxGeometry",
        position: [-4, -6, 4],
        scale: [1, 3, 1],
        rotation: [0, 0, 0],
        color: [1.0, 1.0, 0.0]
    });

    sceneModel.createSceneObject({
        id: "yellowLeg",
        meshIds: ["yellowLegMesh"]
    });

    // Purple table top

    sceneModel.createMesh({
        id: "tableTopMesh",
        geometryId: "myBoxGeometry",
        position: [0, -3, 0],
        scale: [6, 0.5, 6],
        rotation: [0, 0, 0],
        color: [1.0, 0.3, 1.0]
    });

    sceneModel.createSceneObject({ // Create object
        id: "tableTop",
        meshIds: ["tableTopMesh"]
    });

    sceneModel.finalize();

</script>
</html>
````

## Resources

* [xeokit.io](https://xeokit.io/)
* [Examples](http://xeokit.github.io/xeokit-viewer/examples/)
* [Guides](https://www.notion.so/xeokit/xeokit-Documentation-4598591fcedb4889bf8896750651f74e)
* [API Docs](https://xeokit.github.io/xeokit-viewer/docs/)
* [Changelog](https://xeokit.github.io/xeokit-viewer/CHANGE_LOG)
* [Features](https://xeokit.io/index.html?foo=1#features)
* [FAQ](https://xeokit.io/index.html?foo=1#faq)
* [Blog](https://xeokit.io/blog.html)
* [License](https://xeokit.io/index.html#pricing)






