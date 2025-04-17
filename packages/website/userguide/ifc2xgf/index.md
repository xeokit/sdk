## Introduction

---

In this tutorial, we'll view an IFC 4.3 model in the browser using a xeokit doc:Viewer. To optimize performance, we'll first
convert the IFC model to XGF and DataModelParams JSON files. The import process consists of two steps:

1. Use `xeoconvert` with option `--pipeline ifc2xgf` to convert IFC into XGF and JSON DataModelParams files.
2. Use `XGFLoader` and `DataModelParamsLoader` to load the XGF and JSON DataModelParams files into a xeokit Viewer in a webpage.

## Example IFC Model

---

For this tutorial, we'll use the IfcOpenHouse4 Bridge IFC model (source: [`http://drumbeat.cs.hut.fi/ifc/`](http://drumbeat.cs.hut.fi/ifc/)). 

Below is the final result— the model loaded from XGF and DataModelParams JSON files into a xeokit Viewer. 
In the following steps, we'll walk through the process of achieving this.

example-run:ifc2xgf_IfcOpenHouse4

<br>

## Step 1. Convert IFC into XGF and DataModelParams Files

---

The first step is to convert our IFC file into a set of intermediate XGF geometry and JSON DataModelParams files. We'll use
the [`ifc2xgf`]()
CLI tool to do this conversion step:

```bash
xeoconvert --pipeline ifc2xgf --ifc IfcOpenHouse4.ifc --xgf model.xgf --datamodel model.json
```

The parameters we provided the tool are:

- `--pipeline` selects the conversion pipeline
- `--ifc` path to source IFC file 
- `--xkt` path to target XKT file 
- `--datamodel` path to target DataModelParams file (optional)

<br>

## Step 2. View the XGF and DataModelParams Files

---

Now we'll create a Web page containing a xeokit doc:Viewer that views our converted model.

#### HTML

Create an HTML page in `index.html` that contains a canvas element:

example-html:ifc2xgf_IfcOpenHouse4

#### JavaScript

Then create JavaScript in `index.js` to create the doc:Viewer and view our converted model.

The steps in the JavaScript are as follows.

example-javascript:ifc2xgf_IfcOpenHouse4
