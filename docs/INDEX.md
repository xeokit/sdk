# @xeokit

[![Latest NPM release](https://img.shields.io/npm/v/@xeokit-sdk/core.svg)](https://www.npmjs.com/package/@xeokit-sdk/core)
[![Minzipped size](https://badgen.net/bundlephobia/minzip/@xeokit-sdk/core)](https://bundlephobia.com/result?p=@xeokit-sdk/core)
[![License](https://img.shields.io/badge/license-MIT-007ec6.svg)](https://github.com/xeolabs/xeokit-sdk/blob/master/LICENSE)

*Graphics SDK for browser-based AECO visualization.*

## Features

* Next-generation browser-based 3D/2D viewer from @xeolabs
* For BIM & AEC applications
* Fast rendering
* Compact memory footprint
* Multiple canvases
* Semantic ER data model
* Pluggable graphics (WebGL, WebGPU..)
* Natively TypeScript

## Modules

@xeokit is modular:


| Package          | Modules                                                               | Description                                  |
|------------------|:----------------------------------------------------------------------|----------------------------------------------|
| `@xeokit/core`   | [`@xeokit/core/components`](./modules/_xeokit_core_components.html)   | Component types used throughout the xeokit SDK |
|                  | [`@xeokit/core/constants`](./modules/_xeokit_core_constants.html)     | Constants used throughout the xeokit SDK     |
|                  | [`@xeokit/core/utils`](./modules/_xeokit_core_utils.html)             | Core utilities used throughout the xeokit SDK |
| `@xeokit/data`   | [`@xeokit/data`](./modules/_xeokit_data.html)                         | Entity-relationship data model               |
| `@xeokit/math`   | [`@xeokit/math/math`](./modules/_xeokit_math_math.html)               | General math definitions and constants       |
|                  | [`@xeokit/math/boundaries`](./modules/_xeokit_math_boundaries.html)   | Boundaries math library                      |
|                  | [`@xeokit/math/compression`](./modules/_xeokit_math_compression.html) | Geometry de/compression utilities library    |
|                  | [`@xeokit/math/curves`](./modules/_xeokit_math_curves.html)           | Spline curves math library                   |
|                  | [`@xeokit/math/geometry`](./modules/_xeokit_math_geometry.html)       | Mesh generation functions                    |
|                  | [`@xeokit/math/matrix`](./modules/_xeokit_math_matrix.html)           | Matrix and vector math utilities library     |
|                  | [`@xeokit/math/rtc`](./modules/_xeokit_math_rtc.html)                 | Relative-to-center (RTC) coordinates math library |
| `@xeokit/model`  | [`@xeokit/model`](./modules/_xeokit_model.html)                       | Viewer-agnostic model representation         |
| `@xeokit/viewer` | [`@xeokit/viewer`](./modules/_xeokit_viewer.html)                     | Browser-based model viewer                   |
| `@xeokit/webgl`  | [`@xeokit/webgl`](./modules/_xeokit_webgl.html)                       | Configures viewer to use WebGL2              |
| `@xeokit/xkt`    | [`@xeokit/xkt`](./modules/_xeokit_xkt.html)                           | Import and export XKT                        |
| `@xeokit/gltf`   | [`@xeokit/gltf`](./modules/_xeokit_gltf.html)                         | Import and export glTF                       |
| `@xeokit/las`    | [`@xeokit/las`](./modules/_xeokit_las.html)                           | Import LAS                                   |


## Getting started

To learn how @xeokit works, see [Concepts](/concepts.html). To get started developing with the SDK,
see [SDK Installation](#sdk-installation) below. Find [Functions](/functions.html) for example scripts created with the
SDK already. To use the commandline interface, see [Commandline (CLI)](/cli.html). If you're interested in contributing
to or customizing the project, see [contributing](/contributing.html).

### SDK Installation

Install the core WebViewer for programmatic use:

```bash
npm install --save @xeokit/webviewer
```

Then, import some modules:

```typescript
// ES Modules.
import {WebViewer} from '@xeokit/webviewer';

// CommonJS.
const {WebViewer} = require('@xeokit/webviewer');
```

## Concepts

The [WebViewer](./classes/webviewer_src.webviewer.html) class is the core component of
@xeokit. The WebViewer has the following main components:

- A [Scene](./classes/webviewer_src.scene.html) containing [SceneModels](./interfaces/webviewer_src.scene.html)
  and [SceneObjects](./classes/SceneObject.html), which define the geometry
  and materials of our models.
- A [Data](./classes/Data.html)
  containing [DataModels](./classes/DataModel.html)
  and [DataObjects](./classes/DataObject.html), which describe the semantics
  and structure of our models.
- One or more [Views](./classes/View.html), that each create an independent
  view of the Scene. Each View has its own
  canvas, [Camera](./classes/Camera.html),
  and [ViewObjects](./classes/ViewObject.html), which define the appearance
  of
  each SceneObject in that particular View.



## License

Copyright 2020, AGPL3 License.

## Credits

See [*Credits*](/credits.html).
