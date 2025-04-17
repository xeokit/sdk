## Introduction 

---

In this tutorial, we'll load a LAZ model into a xeokit doc:Viewer. To optimize performance, we'll first 
convert the LAZ model to XGF, xeokit's native compressed format. The whole process consists of two steps:
1. Use `las2xkt` to convert the LAZ into XGF.
2Use `XGFLoader` to load the XGF into a xeokit Viewer on a webpage.

## Example Model
---

Below is the final result— the model loaded from an XGF file into a xeokit Viewer.
In the following steps, we'll walk through the process of achieving this.

example-run:las2xgf_Pumpkin

<br>

## Step 1. Convert LAZ to XGF

---

The first step is to convert our LAZ file into an XGF file. 

We'll use the [`xeoconvert`]() CLI tool to do this conversion step:

```bash
node xeoconvert --pipeline las2xgf --las model.laz --xgf model.xgf
```

The parameters we provided the tool are:

- `--pipeline` specifies the conversion pipeline, in this case LAS/LAZ -> XGF
- `--las` specifies the LAS/LAZ file to convert
- `--xgf` specifies the XGF file to output

<br>

## Step 2. View the XGF File

---

Now we'll create a Web page containing a xeokit doc:Viewer and view our converted model with it.

#### HTML

First, create an HTML page in `index.html` that contains a canvas element:

example-html:las2xgf_Pumpkin

#### JavaScript

Then create JavaScript in `index.js` to create the doc:Viewer and view our converted model.

The steps in the JavaScript are as follows.

example-javascript:las2xgf_Pumpkin
