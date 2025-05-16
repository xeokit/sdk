# IFC4 Example: Triangular Mesh Slab

This example IFC4 file (`Minimal_IFC4.ifc`) defines a minimal building model that contains a single `IfcSlab`
represented as a triangular mesh surface model. It is structured according to the standard IFC spatial hierarchy and
uses `IfcFaceBasedSurfaceModel` to describe the slab geometry.

---

## 📁 File Overview

- **IFC Version:** IFC4
- **Purpose:** Demonstrate a minimal valid IFC hierarchy including a slab modeled with a triangular mesh.
- **Geometry Format:** `IfcFaceBasedSurfaceModel` using triangular `IfcFace`s.

---

## 🏗️ IFC Structure

The file follows the standard IFC project structure:

```text
IfcProject
└── IfcSite
    └── IfcBuilding
        └── IfcBuildingStorey
            └── IfcSlab (triangular mesh)
```

---

## 🧱 Geometry

The `IfcSlab` geometry is represented as a set of **triangular mesh faces** using:

- **4 bottom vertices** at Z = 0
- **4 top vertices** at Z = 300 mm
- **4 triangles** forming top and bottom surfaces of the slab:
  - Bottom Face 1: (0,0,0) → (4000,0,0) → (4000,4000,0)
  - Bottom Face 2: (0,0,0) → (4000,4000,0) → (0,4000,0)
  - Top Face 1: (0,0,300) → (4000,0,300) → (4000,4000,300)
  - Top Face 2: (0,0,300) → (4000,4000,300) → (0,4000,300)

> ❗ Note: Side faces are **not included** in this minimal example, but can be added if a closed volume is needed.

---

## 🔧 Technical Details

- **Geometry Type:** `IfcFaceBasedSurfaceModel`
- **Unit:** Implicitly millimeters (no `IfcUnitAssignment` for brevity)
- **Placement:** Global placement using `IfcLocalPlacement` and `IfcAxis2Placement3D`
- **Representation Context:** Defined via `IfcGeometricRepresentationContext`
- **Owner & History:** Standard `IfcOwnerHistory` with a generic author and application

---

## 🔄 Extending This File

You can easily extend or modify this file to include:

- Additional slab faces (sides)
- Property sets (Psets)
- Materials using `IfcMaterialLayerSetUsage`
- Real-world metadata like coordinates, elevation, classification

---

## 📂 File Metadata

- **Filename:** `TriangularSlab.ifc`
- **Created On:** 2025-05-14
- **Author:** Author
- **Organization:** Organization
- **Application:** IFC Generator (IFCGEN)

---

## ✅ Summary

This IFC4 file demonstrates how to model an `IfcSlab` using triangle mesh geometry within a valid spatial hierarchy. It
is useful for testing custom geometry pipelines, validating IFC parsers, or learning about `IfcFaceBasedSurfaceModel`.
