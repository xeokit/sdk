---
title: Load a glTF Model with Realistic Rendering
---

# Load a glTF Model with Realistic Rendering

This tutorial shows how to load a glTF building model and view it with xeokit's
highest-quality presentation features enabled. It uses the HousePlan GLB model
as the example asset, because it is a compact architectural model with PBR
materials that respond clearly to lighting, ambient occlusion, shadows and
tonemapping.

glTF is a runtime delivery format for 3D assets. A `.glb` file packages the
glTF scene, binary buffers and textures into one file, while a `.gltf` file can
reference external `.bin` and texture files. The xeokit `GLTFLoader` reads
either form into a `SceneModel`, where geometry, materials, textures, transforms
and objects become part of the shared `Scene`. It can also populate a
`DataModel` with the glTF node hierarchy when the application needs structural
inspection, although glTF node data is not BIM semantics in the IFC sense.

Realistic rendering is a combination of asset data and view configuration. The
model needs useful PBR inputs such as base color, metallic-roughness, normal and
occlusion textures. The `View` then needs a rendering setup that preserves those
inputs: image-based lighting for ambient irradiance and reflections, a
hemisphere term for soft sky/ground fill, directional shadows for contact with
the ground, SAO for small-scale creases, HDR tonemapping for display output,
bloom for bright specular peaks and antialiasing for a clean final image.

The realism settings in this tutorial are deliberately explicit. They are good
starting points for visual review and marketing-grade screenshots, but they are
more expensive than the defaults. For very large production models, tune shadow
resolution, SAO samples, bloom and render scale against the target hardware.

[![glTF house plan rendered with PBR materials](https://xeokit.github.io/sdk/examples/sdk/import/gltf/house-plan-pbr/index.png)](https://xeokit.github.io/sdk/examples/index.html#sdk/import/gltf/house-plan-pbr)

The live
[glTF House Plan](https://xeokit.github.io/sdk/examples/index.html#sdk/import/gltf/house-plan-pbr)
example loads the same kind of PBR house-plan content this tutorial uses for
realistic rendering setup.

---

## 1. Add a Viewer Page

Create an HTML page with one canvas:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>xeokit Realistic glTF</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      #viewerCanvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="viewerCanvas"></canvas>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
```

The canvas becomes the `htmlElement` for the xeokit `View`.

---

## 2. Create the Viewer and Prefer WebGPU

Create `viewer.js` and initialize the scene, viewer and renderer:

```javascript
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";

const HOUSE_PLAN_URL = "./models/HousePlan/gltf/model.glb";
const ENVIRONMENT_URL = "./environments/studio.hdr";

main().catch((error) => {
  console.error(error);
});

async function main() {
  const scene = new Scene();
  const data = new Data();
  const viewer = new Viewer({scene});

  const renderer = await createBestRenderer(viewer);

  renderer.events.onError.subscribe((_renderer, error) => {
    console.error(error.error);
  });

  const view = createRealisticView(viewer);

  new ModelNavigationController(view);

  await configureEnvironment(view);
  await loadHousePlan({scene, data});
}
```

The renderer is chosen separately from the view. WebGPU is preferred when the
browser supports it; WebGL is used as the fallback. The realism configuration is
attached to the `View`, so the same scene setup remains portable between
renderers.

```javascript
async function createBestRenderer(viewer) {
  const webgpuResult = await WebGPURenderer.create({viewer});

  if (webgpuResult.ok) {
    return webgpuResult.value;
  }

  console.warn(webgpuResult.error);
  return new WebGLRenderer({viewer});
}
```

---

## 3. Configure a Realistic View

Create the view with realistic lighting and post-processing:

```javascript
function createRealisticView(viewer) {
  const viewResult = viewer.createView({
    id: "main",
    htmlElement: document.getElementById("viewerCanvas"),
    backgroundColor: [0.94, 0.96, 0.98],
    camera: {
      projection: "perspective",
      eye: [1396.19, -228.91, 7.61],
      look: [1389.98, -234.98, 2.00],
      up: [-0.39, -0.38, 0.84],
      far: 1000
    },
    lights: {
      hemispheric: {
        enabled: true,
        intensity: 0.55,
        skyColor: [0.62, 0.72, 0.86],
        groundColor: [0.42, 0.36, 0.30],
        worldUp: [0, 0, 1]
      },
      ibl: {
        enabled: true,
        intensity: 1.1
      }
    },
    effects: {
      sky: {
        enabled: true,
        skyColor: [0.70, 0.78, 0.88],
        horizonColor: [0.84, 0.86, 0.88],
        groundColor: [0.46, 0.49, 0.44],
        horizonBlend: 0.32,
        sunEnabled: true,
        sunDirection: [0.32, 0.45, 0.83],
        sunColor: [1.0, 0.94, 0.82],
        sunAngularSize: 2.2,
        sunGlowSize: 12,
        sunGlowIntensity: 0.12,
        worldUp: [0, 0, 1]
      },
      shadows: {
        enabled: true,
        direction: [-0.38, -0.52, -0.76],
        intensity: 0.55,
        autoFit: true,
        maxDistance: 80,
        padding: 1.12,
        resolution: 4096,
        pcfKernelSize: 5,
        contactHardening: true,
        lightRadius: 0.12,
        bias: 0.001,
        normalOffsetBias: 0.0035,
        slopeBias: 0.00125,
        cascadeCount: 4,
        cascadeSplitLambda: 0.5
      },
      sao: {
        enabled: true,
        kernelRadius: 14,
        intensity: 0.18,
        numSamples: 16,
        blur: true,
        bias: 0.5,
        scale: 1.0,
        blendCutoff: 0.3,
        blendFactor: 1.0
      },
      tonemap: {
        enabled: true,
        mode: "aces",
        exposure: 0.8,
        sRGBEncode: true,
        renderScale: 1.25
      },
      bloom: {
        enabled: true,
        threshold: 3.2,
        knee: 0.5,
        intensity: 0.12
      },
      antiAliasing: {
        enabled: true,
        mode: "smaa"
      },
      edges: {
        enabled: false
      }
    }
  });

  if (!viewResult.ok) {
    throw new Error(viewResult.error);
  }

  return viewResult.value;
}
```

The main realism controls are:

- `lights.ibl` for cubemap-based diffuse and specular lighting.
- `lights.hemispheric` for soft sky and ground fill.
- `effects.shadows` for directional shadow maps, cascades and soft contact
  shadows.
- `effects.sao` for creases and small contact darkening that geometry shadows
  often miss.
- `effects.tonemap` for HDR scene output, ACES filmic rolloff and final sRGB
  encoding.
- `effects.bloom` for controlled glow from bright highlights.
- `effects.antiAliasing` for the final edge cleanup pass.

---

## 4. Use an HDR Environment

An HDR environment gives PBR materials useful reflected light. It is a separate
lighting asset, not part of the HousePlan GLB. In this tutorial it is referenced
by `ENVIRONMENT_URL`:

```javascript
const ENVIRONMENT_URL = "./environments/studio.hdr";
```

The file is normally an HDRI: a high-dynamic-range, equirectangular panorama of
a real or synthetic lighting environment. xeokit supports Radiance RGBE `.hdr`
files through `IBL.setEnvironmentHDR`. Radiance HDR is a long-standing image
format for storing brightness ranges above normal 8-bit display values, which
makes it suitable for skies, studio light panels, sun glints and other bright
sources that should influence reflections and tonemapping.

An equirectangular environment image maps longitude horizontally and latitude
vertically. The renderer projects that image into a cubemap, prefilters it, then
uses it for image-based lighting. Diffuse surfaces receive broad ambient
irradiance from the environment. Smooth or metallic surfaces read roughness-based
specular reflections from the same environment through the PBR BRDF.

This is different from `lights.hemispheric`, which is an analytical sky/ground
ambient term and does not provide image reflections. In a realistic PBR view,
IBL usually does the main environment-lighting work, while hemisphere lighting
is kept low as a simple fill term.

```javascript
async function configureEnvironment(view) {
  const environmentResult = await view.lights.ibl.setEnvironmentHDR(ENVIRONMENT_URL);

  if (!environmentResult.ok) {
    console.warn(environmentResult.error);
  }
}
```

Use a neutral studio, overcast exterior, lobby, construction site or other
environment that matches the visual context you want. Serve the `.hdr` with CORS
headers when it is loaded from a different origin. If no HDR file is available,
leave IBL enabled without calling `setEnvironmentHDR`; the renderer will use its
procedural sky-derived environment instead.

---

## 5. Load the HousePlan GLB

Load the glTF into a `SceneModel` and, optionally, a `DataModel`:

```javascript
async function loadHousePlan({scene, data}) {
  const sceneModelResult = scene.createModel({
    id: "housePlan",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const dataModelResult = data.createModel({
    id: "housePlan"
  });

  if (!dataModelResult.ok) {
    throw new Error(dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;
  const fileData = await fetchArrayBuffer(HOUSE_PLAN_URL);

  await new GLTFLoader().load({
    fileData,
    sceneModel,
    dataModel
  });
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  return response.arrayBuffer();
}
```

For a `.glb`, `fileData` is enough because buffers and textures are embedded in
the same binary file. For a multi-file `.gltf`, pass a `baseUri` option so the
loader can resolve relative `.bin` and texture URIs:

```javascript
await new GLTFLoader().load(
  {
    fileData: await fetchArrayBuffer("./models/Sponza/glTF/Sponza.gltf"),
    sceneModel,
    dataModel
  },
  {
    baseUri: "./models/Sponza/glTF/"
  }
);
```

If the glTF uses `KHR_draco_mesh_compression`, inject a Draco decoder through
`GLTFLoader` options:

```javascript
import draco3d from "draco3d";

await new GLTFLoader().load(
  {
    fileData,
    sceneModel
  },
  {
    dracoModule: draco3d
  }
);
```

---

## 6. Tune for the Target

The settings above prioritize image quality. The most common production
adjustments are:

- Reduce `effects.tonemap.renderScale` to `1.0` when fill rate is the bottleneck.
- Reduce `effects.shadows.resolution` from `4096` to `2048` for large scenes or
  lower-end GPUs.
- Reduce `effects.sao.numSamples` before disabling SAO entirely.
- Disable `effects.bloom` for technical inspection views where glow can hide
  small visual details.
- Keep `effects.edges.enabled` disabled for realism; enhanced edges are useful
  for CAD readability, but they make a PBR view look illustrative.

Treat the final values as a view profile for a particular workflow. A product
viewer, visual review tool and BIM coordination screen can use the same
`SceneModel` while choosing different view effects for their own readability and
performance needs.
