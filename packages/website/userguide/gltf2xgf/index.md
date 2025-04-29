## Introduction

---

In this tutorial, we'll view a glTF model in the browser using a xeokit doc:Viewer. To optimize performance, we'll first
convert the glTF file to an XGF file and a doc:DataModelParams JSON file. The import process consists of two steps:

1. Use `xeoconvert` with option **`--pipeline ifc2xgf`** to convert glTF into XGF and JSON DataModelParams files.
2. Use doc:XGFLoader and doc:DataModelParamsLoader to load the XGF and JSON doc:DataModelParams files into a xeokit Viewer in a webpage.

## Example glTF Model

---

For this tutorial, we'll use the Duplex glTF model (source: [`http://drumbeat.cs.hut.fi/ifc/`](http://drumbeat.cs.hut.fi/ifc/)).

Below is the final result— the model loaded from XGF and DataModelParams JSON files into a xeokit Viewer.
In the following steps, we'll walk through the process of achieving this.

example-run:gltf2xgf_Duplex

<br>

## Step 1. Convert glTF into XGF and DataModelParams Files

---

The first step is to convert our glTF file into an XGF file for geometry and JSON DataModelParams file for the glTF scene metadata. We'll use
the xeoconvert CLI tool to do this conversion step:

```bash
npm xeoconvert --pipeline gltf2xgf --gltf model.glb --xgf model.xgf --datamodel model.json
```

The parameters we provided the tool are:

- `--pipeline` selects the conversion pipeline, `gltf2xgf`
- `--gltf` path to source glTF file
- `--xkt` path to target XKT file
- `--datamodel` path to target doc:DataModelParams file (optional)

<br>

## Step 2. View the XGF and DataModelParams Files

---

Now we'll create a Web page containing a xeokit doc:Viewer that views our converted model.

#### HTML

Create an HTML page in `index.html` that contains a canvas element:

example-html:ifc2xgf_Duplex

#### JavaScript

Then create JavaScript in `index.js` to create the doc:Viewer and view our converted model.

The steps in the JavaScript are as follows.

example-javascript:ifc2xgf_Duplex
