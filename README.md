# @xeokit

The xeokit SDK is a development kit for creating browser-based visualizations of AECO models. 

The SDK offers fast model loading and rendering, low memory usage, and support for multiple canvases. The SDK is written in 
TypeScript and follows SOLID principles for software design, enabling maximum extensibility and robustness. Its scene graph 
works on both browser and NodeJS platforms and can be used to create models, convert between formats, and provide content 
for the model viewer. The SDK provides functions for importing and exporting its models as industry-standard AECO file 
formats and allows for interoperability with BIM software via BCF Viewpoints. It also offers utility libraries with 
complete documentation for lower-level functionalities.

## Scene Graph

The SDK represents models in a scene graph that include the model's objects, geometries, and materials. This scene graph works on 
both the browser and NodeJS platforms and can be used to create models, convert between model formats, and provide content for the 
SDK's model viewer.

   
| Package                                                                  | Modules                                                               | Description                                                                  |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------------------------------|
| [`@xeokit/scene`](https://www.npmjs.com/package/@xeokit/scene)           | [`@xeokit/scene`](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html)                       | Scene graph that contains model representations (geometries, materials etc.) |
   
   
[![](https://mermaid.ink/img/pako:eNqNVctu2zAQ_BWBpzZIAhToycc2QC41CsQ58sKQG5stKRp8BDEC_3tXlGgvJSqoL5Rmx7Nv6oNJp4BtmDQihAct9l5Y3ivtQUbt-u7XE--7_MuMbiehh4-CZdyDiLBFGfPla2UwIHwN2YEVKOJe_qCnC3RueMvSxKVW1-fZ3wcXEA5AgT04C9HrCozwHpOHHcQGSqAxud_ZC01lShp9LdHH0eFpaXke9VcNGA61vSRtFAUUhOgdEW6Vawy2ahGt2LxCM4khpW6l2NIZ56-v3qX9oYdAyoV5C1ND7iikjifCEdiM9-v71B_CuDZnJcipXO0421wU-zStiTZLxWj5VLJcMJyUJgVckoUFrA5Bv8HMMIuszMlaXEevrY4oQyAX9LCW4QGks0cc1bCdlTO9fWIstf6R5F9Y3brHikXDu_j_OTkAVXluwRpvE9mYtzysHWffOLu5u8Pz_v6GM7LyFTEjK-xx4v9Ht8EcoSV_WIRCvHRqwapLVfh5iQiXEAuFjGUl-h25s7FpqD2TDSm0crJbZsFboRVe67l3nMUDWOBsg48KXkUykTPen5EqUnS7Uy_ZJvoEtywdFd5H04eAbV6FCYiC0tH57fSpGI7zP49r0Ww?type=png)](https://mermaid.live/edit#pako:eNqNVctu2zAQ_BWBpzZIAhToycc2QC41CsQ58sKQG5stKRp8BDEC_3tXlGgvJSqoL5Rmx7Nv6oNJp4BtmDQihAct9l5Y3ivtQUbt-u7XE--7_MuMbiehh4-CZdyDiLBFGfPla2UwIHwN2YEVKOJe_qCnC3RueMvSxKVW1-fZ3wcXEA5AgT04C9HrCozwHpOHHcQGSqAxud_ZC01lShp9LdHH0eFpaXke9VcNGA61vSRtFAUUhOgdEW6Vawy2ahGt2LxCM4khpW6l2NIZ56-v3qX9oYdAyoV5C1ND7iikjifCEdiM9-v71B_CuDZnJcipXO0421wU-zStiTZLxWj5VLJcMJyUJgVckoUFrA5Bv8HMMIuszMlaXEevrY4oQyAX9LCW4QGks0cc1bCdlTO9fWIstf6R5F9Y3brHikXDu_j_OTkAVXluwRpvE9mYtzysHWffOLu5u8Pz_v6GM7LyFTEjK-xx4v9Ht8EcoSV_WIRCvHRqwapLVfh5iQiXEAuFjGUl-h25s7FpqD2TDSm0crJbZsFboRVe67l3nMUDWOBsg48KXkUykTPen5EqUnS7Uy_ZJvoEtywdFd5H04eAbV6FCYiC0tH57fSpGI7zP49r0Ww)

## Data Graph

The SDK employs a generic entity-relationship data graph to manage model semantics, which includes entities, properties, and 
relationships. This data graph is compatible with both the browser and NodeJS and facilitates model generation, format conversion, 
and content navigation within the SDK's model viewer.


| Package                                                                  | Modules                                                               | Description                                                                  |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------------------------------|
| [`@xeokit/data`](https://www.npmjs.com/package/@xeokit/data)             | [`@xeokit/data`](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html)                        | Entity-relationship graph that contains model semantic data.                 |
   
[![](https://mermaid.ink/img/pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg?type=png)](https://mermaid.live/edit#pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg)


## Model Viewer

The SDK contains a high-performance Web viewer for displaying our model representations. Through a pluggable renderer strategy, 
the viewer can be extended to utilize various browser graphics APIs, including WebGL and WebGPU. Multiple models can be viewed 
simultaneously, and the viewer allows for the creation of separate canvases, featuring lights, section planes, annotations, 
and other elements, to display multiple views of our models.


| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/viewer`](https://www.npmjs.com/package/@xeokit/viewer)         | [`@xeokit/viewer`](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html)                     | Browser-based model viewer                           |
| [`@xeokit/cameracontrol`](https://www.npmjs.com/package/@xeokit/cameracontrol)  | [`@xeokit/cameracontrol`](https://xeokit.github.io/sdk/docs/modules/cameracontrol.html)        | Interactive camera control for a viewer                     |
| [`@xeokit/webglrenderer`](https://www.npmjs.com/package/@xeokit/webglrenderer)  | [`@xeokit/webglrenderer`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webglrenderer.html) | WebGL rendering strategy for a viewer       |
| [`@xeokit/treeview`](https://www.npmjs.com/package/@xeokit/treeview)     | [`@xeokit/treeview`](https://xeokit.github.io/sdk/docs/modules/_xeokit_treeview.html)                 | HTML tree view widget for a Viewer                          |
| [`@xeokit/locale`](https://www.npmjs.com/package/@xeokit/locale)     | [`@xeokit/locale`](https://xeokit.github.io/sdk/docs/modules/_xeokit_locale.html)                 | Localization service for a viewer                         |

[![](https://mermaid.ink/img/pako:eNqNVctu2zAQ_BWBp7aIg-YqGL44QHqwEcPu48ILRW1iJhSpkpQbN82_l-9QtlzUF1E7s7PL9ZB6RVS2gGpEOdH6lpFHRTosWqaAGiZFtdpi4bHqO4NfoKpXLKrwUyBaUKBCQFMQEJYHy9RhSRUQAy71w8cQweKtVEx6lIgDiUmyebLVkwLpQJGw5uxxn-I6NLjhREAMcXIENSq8cpFUOYR2Rd4YWTl1Fxo16CVSl6yd6PDnQDgzx60fx0n2vSeeph-YZg2HtBFuKRChvW3CbzMFXpRtIK6p5FKx3zGRctb3JOv0jD6_vxHSNEUvSz_F1AccoYojk_I5rIY-yij5FEZUpJdDSyK91FVUsXYp_9dbpvwsE9PBieq3MHLBNtrIs-dz0mijCDWLRcH5Ac3dakQs9zZoI7tN7juV7YhR7KXchbNoRq3v-aThvBnWDs7-4EDUyBleynP-aY2gFUyQxJqB8Ta9tGB3K4_n2ufGsTgW4RBidIPRbLbwz20-hhPgLpzK8MjApwiEIhdhv7-IhvVFhdPSFnehOl4Fbn0Ghtw6D-w95imjLUSuNUuvQIMwumKi-vJ1vco3x2QNf3rrdDHkCEafr6__o53RLJfxJjorlPxep_vpjFGeHyyiUKm9sf31jnSYxu-V2ctJ5NT9WORzMv8zm50cnbpiXc-hcxOcYm6-XaCW18hSCmva7Hx_33t_juDRjG_CjNEVsoyOsNZ-cnw6RmZva2BU22ULD2Tg9u-3apZKBiN3R0FRbdQAV2joW3ua4kcK1Q-EaxuFlhmp1vEz5h5vfwF9HEi3?type=png)](https://mermaid.live/edit#pako:eNqNVctu2zAQ_BWBp7aIg-YqGL44QHqwEcPu48ILRW1iJhSpkpQbN82_l-9QtlzUF1E7s7PL9ZB6RVS2gGpEOdH6lpFHRTosWqaAGiZFtdpi4bHqO4NfoKpXLKrwUyBaUKBCQFMQEJYHy9RhSRUQAy71w8cQweKtVEx6lIgDiUmyebLVkwLpQJGw5uxxn-I6NLjhREAMcXIENSq8cpFUOYR2Rd4YWTl1Fxo16CVSl6yd6PDnQDgzx60fx0n2vSeeph-YZg2HtBFuKRChvW3CbzMFXpRtIK6p5FKx3zGRctb3JOv0jD6_vxHSNEUvSz_F1AccoYojk_I5rIY-yij5FEZUpJdDSyK91FVUsXYp_9dbpvwsE9PBieq3MHLBNtrIs-dz0mijCDWLRcH5Ac3dakQs9zZoI7tN7juV7YhR7KXchbNoRq3v-aThvBnWDs7-4EDUyBleynP-aY2gFUyQxJqB8Ta9tGB3K4_n2ufGsTgW4RBidIPRbLbwz20-hhPgLpzK8MjApwiEIhdhv7-IhvVFhdPSFnehOl4Fbn0Ghtw6D-w95imjLUSuNUuvQIMwumKi-vJ1vco3x2QNf3rrdDHkCEafr6__o53RLJfxJjorlPxep_vpjFGeHyyiUKm9sf31jnSYxu-V2ctJ5NT9WORzMv8zm50cnbpiXc-hcxOcYm6-XaCW18hSCmva7Hx_33t_juDRjG_CjNEVsoyOsNZ-cnw6RmZva2BU22ULD2Tg9u-3apZKBiN3R0FRbdQAV2joW3ua4kcK1Q-EaxuFlhmp1vEz5h5vfwF9HEi3)

## Model Importers and Exporters

The SDK provides functions for importing and exporting its model representations and semantics as industry-standard 
AECO file formats. These functions can be used in NodeJS scripts for file format conversion or in the browser to load 
various file formats into the viewer.

| Package                                                              | Modules                                                                               | Description                |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------------|----------------------------|
| [`@xeokit/xkt`](https://www.npmjs.com/package/@xeokit/xkt)           | [`@xeokit/xkt`](https://xeokit.github.io/sdk/docs/modules/_xeokit_xkt.html)           | Import and export XKT files |
| [`@xeokit/gltf`](https://www.npmjs.com/package/@xeokit/gltf)         | [`@xeokit/gltf`](https://xeokit.github.io/sdk/docs/modules/_xeokit_gltf.html)         | Import glTF files |
| [`@xeokit/las`](https://www.npmjs.com/package/@xeokit/las)           | [`@xeokit/las`](https://xeokit.github.io/sdk/docs/modules/_xeokit_las.html)           | Import LAS pointcloud scans |
| [`@xeokit/cityjson`](https://www.npmjs.com/package/@xeokit/cityjson) | [`@xeokit/cityjson`](https://xeokit.github.io/sdk/docs/modules/_xeokit_cityjson.html) | Import CityJSON files      |
| [`@xeokit/webifc`](https://www.npmjs.com/package/@xeokit/webifc)     | [`@xeokit/webifc`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webifc.html)     | Import IFC files           |

### Interoperating with BIM Software

The SDK offers functions for sharing bookmarks of viewer state with other BIM software as industry-standard BCF Viewpoints. 
These functions can be used to develop applications that facilitate collaboration on construction projects.

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/bcf`](https://www.npmjs.com/package/@xeokit/bcf)               | [`@xeokit/bcf`](https://xeokit.github.io/sdk/docs/modules/_xeokit_bcf.html)                           | Load and save BCF                    |

### Utility Libraries

The SDK's internal and lower-level functionalities are mostly available as utility libraries with complete documentation.

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/core`](https://www.npmjs.com/package/@xeokit/core)             | [`@xeokit/core/components`](https://xeokit.github.io/sdk/docs/modules/_xeokit_core_components.html)   | Basic component types used throughout the xeokit SDK |
|                                                                          | [`@xeokit/core/constants`](https://xeokit.github.io/sdk/docs/modules/_xeokit_core_constants.html)     | Constants used throughout the xeokit SDK             |
|                                                                          | [`@xeokit/core/utils`](https://xeokit.github.io/sdk/docs/modules/_xeokit_core_utils.html)             | Core utilities used throughout the xeokit SDK        |
| [`@xeokit/datatypes`](https://www.npmjs.com/package/@xeokit/datatypes)   | [`@xeokit/datatypes/basicTypes`](https://xeokit.github.io/sdk/docs/modules/_xeokit_datatypes_basicTypes.html)  | Basic semantic data type constants  |
|                                                                          | [`@xeokit/datatypes/ifcTypes`](https://xeokit.github.io/sdk/docs/modules/_xeokit_datatypes_ifcTypes.html)      | IFC data type constants  |
| [`@xeokit/math`](https://www.npmjs.com/package/@xeokit/math)             | [`@xeokit/math/math`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_math.html)               | General math definitions and constants               |
|                                                                          | [`@xeokit/math/boundaries`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_boundaries.html)   | Boundaries math library                              |
|                                                                          | [`@xeokit/math/compression`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_compression.html) | Geometry de/compression utilities library            |
|                                                                          | [`@xeokit/math/curves`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_curves.html)           | Spline curves math library                           |
|                                                                          | [`@xeokit/math/geometry`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_geometry.html)       | Mesh generation functions                            |
|                                                                          | [`@xeokit/math/matrix`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_matrix.html)           | Matrix and vector math utilities library             |
|                                                                          | [`@xeokit/math/rtc`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_rtc.html)                 | Relative-to-center (RTC) coordinates math library    |
| [`@xeokit/webgl`](https://www.npmjs.com/package/@xeokit/webglutils)      | [`@xeokit/webglutils`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webglutils.html)             | WebGL utilities library        |
| [`@xeokit/procgen`](https://www.npmjs.com/package/@xeokit/procgen)       | [`@xeokit/procgen/geometry`](https://xeokit.github.io/sdk/docs/modules/_xeokit_procgen_geometry.html) | Geometry generation functions                     |
| [`@xeokit/ktx2`](https://www.npmjs.com/package/@xeokit/ktx2)             | [`@xeokit/ktx2`](https://xeokit.github.io/sdk/docs/modules/_xeokit_ktx2.html)                         | Compressed texture support              |



# Quick Start

## Examples

### Spinning Textured Box

Let's make a simple application using xeokit - a spinning, textured box.

First import the npm modules we need from the SDK:

````bash
npm install @xeokit/scene
npm install @xeokit/viewer
npm install @xeokit/webglrenderer
npm install @xeokit/core/constants
````

Here's the JavaScript for our spinning box app:

````javascript
import {Scene} from "@xeokit/scene";
import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
import {Viewer} from "@xeokit/viewer";
import {WebGLRenderer} from "@xeokit/webglrenderer";

const scene = new Scene(); // Scene graph

const renderer = new WebGLRenderer({}); // WebGL renderer kernel

const viewer = new Viewer({ // Browser-base viewer
    scene,
    renderer
});

const view = myViewer.createView({ // Independent view 
    id: "myView",
    canvasId: "myView1"
});

view.camera.eye = [0, 0, 10]; // Looking down the -Z axis
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];

const sceneModel = scene.createModel(); // Start building the scene graph

sceneModel.createGeometry({ // Define a box-shaped geometry
    id: "boxGeometry",
    primitive: TrianglesPrimitive,
    positions: [-1, -1, -1, 1, -1, -1, ],
    uvs: [1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, ],
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, ]
});

sceneModel.createTexture({ // 
    id: "boxColorTexture",
    src: "myTexture.png",
    encoding: LinearEncoding,
    magFilter: LinearFilter,
    minFilter: LinearFilter
});

sceneModel.createTextureSet({
    id: "boxTextureSet",
    colorTextureId: "boxColorTexture"
});

sceneModel.createMesh({
    id: "boxMesh",
    geometryId: "boxGeometry",
    color: [1, 1, 1],
    metallic: 0.8, // PBR material attributes
    roughness: 0.3,
    textureSetId: "boxTextureSet"
});

sceneModel.createObject({
    id: "boxObject",
    meshIds: ["boxMesh"]
});

sceneModel.build().then(() => { // Compresses textures, geometries etc.

    // A textured box object now appears on our View's canvas.

    // We can now show/hide/select/highlight our box through the View:

    view.objects["boxObject"].visible = true;
    view.objects["boxObject"].highlighted = false;  // etc.

    // Start orbiting the camera:

    viewer.onTick.subscribe(() => {
        view.camera.orbitYaw(1.0);
    });
});
````

### glTF Model Viewer

Let's make a simple application that views a glTF file in the browser.

First import the npm modules we need from the SDK:

````bash
npm install @xeokit/scene
npm install @xeokit/viewer
npm install @xeokit/webglrenderer
npm install @xeokit/core/constants
npm install @xeokit/gltf
````

Here's the JavaScript for our glTF viewer app:

````javascript
import {Scene} from "@xeokit/scene";
import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
import {Viewer} from "@xeokit/viewer";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import {loadGLTF} from "@xeokit/gltf";

const scene = new Scene(); // Scene graph

const renderer = new WebGLRenderer({}); // WebGL renderer kernel

const viewer = new Viewer({ // Browser-base viewer
    scene,
    renderer
});

const view = myViewer.createView({ // Independent view 
    id: "myView",
    canvasId: "myView1"
});

view.camera.eye = [0, 0, 10]; // Looking down the -Z axis
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];

const sceneModel = scene.createModel(); // Start building the scene graph

fetch("myModel.xkt").then(response => {
  
    response.arrayBuffer().then(data => {
       
        loadGLTF({data, scene}).then(() => {

            sceneModel.build().then(() => { // Compresses textures, geometries etc.

                // A model now appears on our View's canvas.

                // We can now show/hide/select/highlight the model's objects through the View:

                view.objects["2hExBg8jj4NRG6zzE$aSi6"].visible = true;    
                view.objects["2hExBg8jj4NRG6zzE$aSi6"].highlighted = false;  // etc.

                // Start orbiting the camera:

                viewer.onTick.subscribe(() => {
                    view.camera.orbitYaw(1.0);
                });
            });
        });
    });
});
````

### Convert a glTF file to XKT 

Let's make a simple NodeJS script that converts a glTF file into xeokit's native XKT format.

First import the npm modules we need from the SDK. Note that we don't need the viewer for this example.

````bash
npm install @xeokit/scene
npm install @xeokit/core/constants
npm install @xeokit/gltf
npm install @xeokit/xkt
````

Here's the JavaScript for our converter script:

````javascript
import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
import {loadGLTF} from "@xeokit/gltf";
import {saveXKT} from "@xeokit/xkt";

const fs = require('fs');

const scene = new Scene(); // Scene graph
const sceneModel = scene.createModel({ id: "myModel" }); // Start building the scene graph

const data = new Data();
const dataModel = data.createModel({ id: "myModel" }); // Will model the glTF scene hierarchy

fs.readFile("./tests/assets/HousePlan.glb", (err, buffer) => {
    const arraybuffer = toArrayBuffer(buffer);
    loadGLTF({
        data: arrayBuffer,
        sceneModel,
        dataModel
    }).then(() => {
        sceneModel.build().then(() => { // Compresses textures, geometries etc.
            const arrayBuffer = saveXKT({ sceneModel, dataModel });
            fs.writeFile('myModel.xkt', arrayBuffer, err => {});
        });
    })
});

function toArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}
````

# License

Copyright 2020, AGPL3 License.

# Credits

See [*Credits*]().
