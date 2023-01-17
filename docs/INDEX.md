# xeokit-webviewer

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

xeokit-webviewer is modular:

| Package                       | Contents                                                                  | Description                                                                                                |
|-------------------------------|:--------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `@xeokit/webviewer`           | [WebViewer](./classes/webviewer_src.webviewer.html)                       | An extensible browser-based 3D viewer for AEC applications.                                                |
| `@xeokit/webviewer-xktloader` | [XKTLoaderPlugin](./classes/webviewer_xktloader_src.xktloaderplugin.html) | A WebViewer plugin to load models from our native, supercompressed XKT format.                             |
| `@xeokit/webviewer-treeview`  | [TreeViewPlugin](./classes/webviewer_xktloader_src.treeviewplugin.html)   | A WebViewer plugin that provides an HTML tree view widget to navigate viewer objects.                      |
| `@xeokit/webviewer-navcube`   | [NavCubePlugin](./classes/webviewer_navcube_src.navcubeplugin.html)       | A WebViewer plugin that provides an interactive NavCube control to assist camera navigation                |
| `@xeokit/webviewer-bcf `      | [BCFPlugin](./classes/webviewer_bcf_src.bcfplugin.html)                   | A WebViewer plugin that saves and loads viewer state as BCF viewpoints.                                    |
| `@xeokit/convert2xkt`         | [convert2xkt](./classes/webviewer_navcube_src.navcubeplugin.html)         | NodeJS-based CLI tool and library for converting various AEC file formats into xeokit's native XKT format. |

## Getting started

To learn how xeokit-webviewer works, see [Concepts](/concepts.html). To get started developing with the SDK,
see [SDK Installation](#sdk-installation) below. Find [Functions](/functions.html) for example scripts created with the
SDK already. To use the commandline interface, see [Commandline (CLI)](/cli.html). If you're interested in contributing
to or customizing the project, see [contributing](/contributing.html).

### SDK Installation

Install the core WebViewer for programmatic use:

```shell
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
xeokit-webviewer. The WebViewer has the following main components:

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
