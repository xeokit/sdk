Vite app created with vanilla-ts starter.

Motivation:
* test `xeokit/sdk` against strict typescript checks
* write standalone examples in typescript which will be embed  in [xeokit-docs](https://github.com/xeokit/xeokit-docs) - docusaurus web app:
  - main.ts as source of documentation markdowns
  - vite app as live playground via stackblitz like solution
* as result:
  - this repository contains: 
    - `xeokit/sdk` - strong typescript package for 3D visualization + source of documentation (typedoc)
    - `xeokit/examples` - standalone typescript examples how to use xeokit/sdk + source for documentation (main.ts)
  - [xeokit-docs](https://github.com/xeokit/xeokit-docs) repository contains
    - xeokit blog
    - xeokit/sdk - (v3) documentation (main.ts + typedoc)
    - xeokit/xeokit-sdk - (v2) documentation (iframe embed old sdk, bimviewer, jsdoc examples)

Configuration of project. 
* strict type checking
* linting from root of repository
* app serve index.html as simple table of content (html-map.json created by vite plugin)
* examples (main.ts) shows how to use xeokit/sdk which is aliased in vite configuration (no need for rebuild sdk)
* models in examples are references to external sources not relative reference `const model = "https://raw.githubusercontent.com/xeokit/sdk/refs/heads/develop/packages/website/models/BlenderHouse/dotbim/model.bim"`
  

```
  pnpm examples:dev
  pnpm examples:build
  pnpm examples:preview
```
